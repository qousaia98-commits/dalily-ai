/**
 * Sprint 6 Phase 2 — Business subscription payment lifecycle.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingSettings } from "@/lib/monetization/settings";
import { upgradeToBusinessPlan } from "@/lib/monetization/plans";
import { createPaymentIntent } from "@/lib/payment/orchestration";
import { snapshotPaymentStatus } from "@/lib/payment/status-snapshots";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { getPaymentConfig, isPaymentConfigured } from "@/lib/payment/config";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function startBusinessSubscriptionPayment(input: {
  providerId: string;
  actorUserId?: string | null;
  renewal?: boolean;
}): Promise<
  | {
      ok: true;
      paymentId: string;
      reference: string;
      amount: number;
      currency: string;
      instructions?: {
        receiver: string;
        account: string;
        swift?: string;
        bankName?: string;
      };
      checkoutUrl?: string;
      publishableKey?: string;
    }
  | { ok: false; error: string }
> {
  const config = getPaymentConfig();
  if (!isPaymentConfigured(config)) {
    return { ok: false, error: "payment_not_configured" };
  }

  const settings = await getBillingSettings();
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const periodYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const idempotencyKey = `business_sub:${input.providerId}:${periodYm}:${input.renewal ? "renew" : "new"}`;

  const intent = await createPaymentIntent({
    providerId: input.providerId,
    purpose: "business_subscription",
    amount: settings.businessPriceUsd,
    currency: settings.currency || "USD",
    idempotencyKey,
    metadata: {
      renewal: Boolean(input.renewal),
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd: periodEnd.toISOString().slice(0, 10),
    },
  });

  if (!intent.ok) return intent;

  try {
    await db().from("business_subscription_payments").upsert(
      {
        payment_id: intent.result.paymentId,
        provider_id: input.providerId,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        renewal: Boolean(input.renewal),
      },
      { onConflict: "payment_id" },
    );
  } catch {
    // soft
  }

  void emitAiLearningEvent({
    eventType: "subscription_payment_started",
    providerId: input.providerId,
    metadata: {
      anonymized: true,
      renewal: Boolean(input.renewal),
      amount: settings.businessPriceUsd,
    },
  });

  return {
    ok: true,
    paymentId: intent.result.paymentId,
    reference: intent.result.reference,
    amount: intent.result.amount,
    currency: intent.result.currency,
    instructions: intent.result.instructions,
    checkoutUrl: intent.result.checkoutUrl,
    publishableKey: intent.result.publishableKey,
  };
}

/**
 * Open (pending / pending_review) Business subscription payment for a provider.
 */
export async function getActiveBusinessSubscriptionPayment(
  providerId: string,
): Promise<{
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  hasReceipt: boolean;
  receiver: string;
  account: string;
  swift?: string;
  bankName?: string;
  checkoutUrl?: string;
} | null> {
  const config = getPaymentConfig();
  const { data } = await db()
    .from("payments")
    .select("*")
    .eq("provider_id", providerId)
    .eq("purpose", "business_subscription")
    .in("payment_status", ["pending", "pending_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  let checkoutUrl: string | undefined;
  if (
    data.payment_provider === "stripe" &&
    data.stripe_checkout_session_id &&
    data.payment_status === "pending"
  ) {
    try {
      const { getStripe } = await import("@/lib/payment/stripe/client");
      const session = await getStripe().checkout.sessions.retrieve(
        String(data.stripe_checkout_session_id),
      );
      checkoutUrl = session.url ?? undefined;
    } catch {
      checkoutUrl = undefined;
    }
  }

  return {
    paymentId: String(data.id),
    reference: String(data.payment_reference ?? ""),
    amount: Number(data.amount),
    currency: String(data.currency ?? "USD"),
    status: String(data.payment_status),
    hasReceipt: Boolean(data.receipt_path),
    receiver: config.receiver,
    account: config.account,
    swift: config.swift || undefined,
    bankName: config.bankName || undefined,
    checkoutUrl,
  };
}

/**
 * After verified payment success — activate/renew Business plan.
 */
export async function activateBusinessSubscriptionFromPayment(input: {
  paymentId: string;
  actorUserId: string;
  source: "admin_approval" | "webhook";
}): Promise<{ ok: true; renewed: boolean } | { ok: false; error: string }> {
  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, error: "payment_not_found" };
  if (payment.purpose !== "business_subscription") {
    return { ok: false, error: "not_business_subscription" };
  }

  const { data: subPay } = await db()
    .from("business_subscription_payments")
    .select("*")
    .eq("payment_id", input.paymentId)
    .maybeSingle();

  const renewed = Boolean(subPay?.renewal);

  if (payment.payment_status !== "paid") {
    const from = payment.payment_status as string;
    const { error } = await db()
      .from("payments")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        approved_by: input.actorUserId,
      })
      .eq("id", input.paymentId)
      .in("payment_status", ["pending", "pending_review"]);
    if (error) return { ok: false, error: error.message };

    await snapshotPaymentStatus({
      paymentId: input.paymentId,
      fromStatus: from,
      toStatus: "paid",
      actorUserId: input.actorUserId,
      source: input.source === "webhook" ? "webhook" : "admin",
      note: "business_subscription_activated",
    });
  }

  await upgradeToBusinessPlan({
    providerId: String(payment.provider_id),
    actorUserId: input.actorUserId,
  });

  await db()
    .from("business_subscription_payments")
    .update({ activated_at: new Date().toISOString() })
    .eq("payment_id", input.paymentId);

  await db()
    .from("provider_monetization_plans")
    .update({
      subscription_payment_id: input.paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("provider_id", payment.provider_id);

  void emitAiLearningEvent({
    eventType: renewed
      ? "subscription_renewed"
      : "subscription_payment_activated",
    providerId: String(payment.provider_id),
    metadata: { anonymized: true, paymentId: input.paymentId },
  });

  try {
    const { ensureFinancialDocumentAfterPayment } = await import(
      "@/lib/financial-documents"
    );
    await ensureFinancialDocumentAfterPayment({
      paymentId: input.paymentId,
      actorUserId: input.actorUserId,
    });
  } catch {
    // soft
  }

  return { ok: true, renewed };
}
