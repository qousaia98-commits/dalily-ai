"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { getStripePaymentProvider } from "@/lib/payment/payment.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStripeEvent } from "@/lib/payment/stripe/webhooks";
import { getStripe } from "@/lib/payment/stripe/client";
import type Stripe from "stripe";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function openStripeBillingPortalAction(): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  if (!isProviderMonetizationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const stripe = getStripePaymentProvider();
  if (!stripe) return { success: false, error: "stripe_inactive" };

  const { data: plan } = await db()
    .from("provider_monetization_plans")
    .select("stripe_customer_id")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!plan?.stripe_customer_id) {
    return { success: false, error: "no_stripe_customer" };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const url = await stripe.createBillingPortalSession({
    customerId: String(plan.stripe_customer_id),
    returnUrl: `${appUrl}/business/monetization`,
  });
  return { success: true, url };
}

export async function cancelStripeRenewalAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isProviderMonetizationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const stripe = getStripePaymentProvider();
  if (!stripe) return { success: false, error: "stripe_inactive" };

  const { data: plan } = await db()
    .from("provider_monetization_plans")
    .select("stripe_subscription_id")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!plan?.stripe_subscription_id) {
    return { success: false, error: "no_subscription" };
  }

  await stripe.cancelSubscriptionRenewal(String(plan.stripe_subscription_id));
  await db()
    .from("provider_monetization_plans")
    .update({
      cancel_at_period_end: true,
      renewal_cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider_id", provider.id);

  revalidatePath("/business/monetization");
  return { success: true };
}

export async function listMyStripeInvoicesAction(): Promise<
  | {
      ok: true;
      invoices: Array<{
        id: string;
        number: string | null;
        status: string | null;
        amountPaid: number;
        currency: string;
        hostedInvoiceUrl: string | null;
        created: number;
      }>;
    }
  | { ok: false; error: string }
> {
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };

  const stripe = getStripePaymentProvider();
  if (!stripe) return { ok: false, error: "stripe_inactive" };

  const { data: plan } = await db()
    .from("provider_monetization_plans")
    .select("stripe_customer_id")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!plan?.stripe_customer_id) return { ok: true, invoices: [] };
  const invoices = await stripe.listInvoices(String(plan.stripe_customer_id));
  return { ok: true, invoices };
}

export async function listStripeWebhookEventsAction(limit = 50): Promise<
  | {
      ok: true;
      events: Array<{
        id: string;
        externalEventId: string;
        eventType: string;
        status: string;
        paymentId: string | null;
        errorMessage: string | null;
        retryCount: number;
        createdAt: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const { data } = await db()
    .from("payment_webhook_events")
    .select("*")
    .eq("provider", "stripe")
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    ok: true,
    events: (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      externalEventId: String(row.external_event_id),
      eventType: String(row.event_type),
      status: String(row.processing_status),
      paymentId: row.payment_id ? String(row.payment_id) : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
      retryCount: Number(row.retry_count ?? 0),
      createdAt: String(row.created_at),
    })),
  };
}

export async function retryStripeWebhookEventAction(
  eventRowId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { success: false, error: "forbidden" };

  const { data: row } = await db()
    .from("payment_webhook_events")
    .select("*")
    .eq("id", eventRowId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (!row) return { success: false, error: "not_found" };
  if (row.processing_status === "processed") {
    return { success: false, error: "already_processed" };
  }

  const externalId = String(row.external_event_id);
  if (externalId.startsWith("invalid_sig_")) {
    return { success: false, error: "cannot_retry_invalid_signature" };
  }

  try {
    const event = await getStripe().events.retrieve(externalId);
    // Allow re-processing: bump retry + reset status temporarily
    await db()
      .from("payment_webhook_events")
      .update({
        processing_status: "received",
        retry_count: Number(row.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", eventRowId);

    // Delete duplicate key block by using a synthetic reprocess — processStripeEvent
    // treats duplicate_processed as success; force by deleting and re-inserting path:
    await db().from("payment_webhook_events").delete().eq("id", eventRowId);

    const result = await processStripeEvent(event as Stripe.Event);
    if (!result.ok) return { success: false, error: result.error };
    revalidatePath("/admin/payments");
    revalidatePath("/admin/webhooks");
    return { success: true };
  } catch (e) {
    await db()
      .from("payment_webhook_events")
      .update({
        processing_status: "failed",
        error_message: e instanceof Error ? e.message : "retry_failed",
        last_retry_at: new Date().toISOString(),
        retry_count: Number(row.retry_count ?? 0) + 1,
      })
      .eq("id", eventRowId);
    return {
      success: false,
      error: e instanceof Error ? e.message : "retry_failed",
    };
  }
}
