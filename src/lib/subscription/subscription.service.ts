import { createAdminClient } from "@/lib/supabase/admin";
import { sendPlanActivatedEmail, sendPaymentRejectedEmail } from "@/lib/email/dalily-email";
import { getProviderOwnerEmailContext } from "@/lib/email/provider-email-context";
import { resolvePaymentProvider } from "@/lib/payment/payment.service";
import { allocateUniquePaymentReference } from "@/lib/payment/reference";
import { logPaymentEvent } from "@/lib/payment/payment-events";
import {
  createInvoiceForPayment,
  ensureFreeSubscription,
  getCurrentSubscription,
  getPlanById,
  getPlanBySlug,
} from "@/lib/subscription/repository";
import type { PlanSlug } from "@/lib/subscription/types";

const SUBSCRIPTION_PERIOD_DAYS = 30;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function applyPlanBenefits(providerId: string, planSlug: PlanSlug, expiresAt: string | null) {
  const admin = createAdminClient();

  const { data: provider } = await admin
    .from("providers")
    .select("metadata")
    .eq("id", providerId)
    .maybeSingle();

  const existingMeta =
    provider?.metadata && typeof provider.metadata === "object" && !Array.isArray(provider.metadata)
      ? (provider.metadata as Record<string, unknown>)
      : {};

  const metadata = {
    ...existingMeta,
    subscription_plan: planSlug,
  };

  if (planSlug === "premium") {
    await admin
      .from("providers")
      .update({
        metadata,
        is_featured: true,
        featured_until: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId);
  } else {
    await admin
      .from("providers")
      .update({
        metadata,
        is_featured: false,
        featured_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId);
  }
}

export class SubscriptionService {
  async getStatus(providerId: string) {
    await ensureFreeSubscription(providerId);
    return getCurrentSubscription(providerId);
  }

  async upgrade(providerId: string, targetPlanSlug: PlanSlug, billingCycle: "monthly" | "yearly" = "monthly") {
    const admin = createAdminClient();
    const { data: provider } = await admin
      .from("providers")
      .select("id, status")
      .eq("id", providerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!provider || provider.status !== "active") {
      throw new Error("provider_not_approved");
    }

    const targetPlan = await getPlanBySlug(targetPlanSlug);
    if (!targetPlan || targetPlan.slug === "free") {
      throw new Error("invalid_plan");
    }

    const current = await this.getStatus(providerId);
    const amount =
      billingCycle === "yearly" ? targetPlan.yearlyPriceUsd : targetPlan.monthlyPriceUsd;

    if (current && current.status === "active" && current.planSlug === targetPlanSlug) {
      throw new Error("already_on_plan");
    }

    const { data: openPayments } = await admin
      .from("payments")
      .select("id")
      .eq("provider_id", providerId)
      .in("payment_status", ["pending", "pending_review"])
      .limit(1);

    if (openPayments && openPayments.length > 0) {
      throw new Error("payment_pending");
    }

    const { data: subscription, error } = await admin
      .from("subscriptions")
      .insert({
        provider_id: providerId,
        plan_id: targetPlan.id,
        status: "pending_payment",
        auto_renew: true,
      })
      .select("id")
      .single();

    if (error || !subscription) {
      throw new Error("subscription_create_failed");
    }

    const paymentProvider = resolvePaymentProvider();
    const reference = await allocateUniquePaymentReference();
    const result = await paymentProvider.createPayment({
      providerId,
      subscriptionId: subscription.id,
      amount,
      currency: "USD",
      reference,
    });

    await logPaymentEvent({
      paymentId: result.paymentId,
      eventType: "requested",
    });

    return { subscriptionId: subscription.id, payment: result };
  }

  async downgrade(providerId: string) {
    const freePlan = await getPlanBySlug("free");
    if (!freePlan) throw new Error("free_plan_missing");

    const admin = createAdminClient();
    const now = new Date().toISOString();

    await admin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: now })
      .eq("provider_id", providerId)
      .in("status", ["trial", "active", "pending_payment"]);

    await admin.from("subscriptions").insert({
      provider_id: providerId,
      plan_id: freePlan.id,
      status: "active",
      auto_renew: true,
    });

    await applyPlanBenefits(providerId, "free", null);
  }

  async cancel(providerId: string) {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    await admin
      .from("subscriptions")
      .update({ status: "cancelled", auto_renew: false, updated_at: now })
      .eq("provider_id", providerId)
      .in("status", ["trial", "active", "pending_payment"]);

    await this.downgrade(providerId);
  }

  async renew(providerId: string) {
    const current = await this.getStatus(providerId);
    if (!current || current.planSlug === "free") {
      throw new Error("nothing_to_renew");
    }
    return this.upgrade(providerId, current.planSlug as PlanSlug);
  }

  async submitPaymentReceipt(
    paymentId: string,
    providerId: string,
    receiptPath: string,
    receiptMimeType: string,
  ) {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: payment } = await admin
      .from("payments")
      .select("id, payment_status, provider_id, receipt_path")
      .eq("id", paymentId)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (!payment || payment.payment_status !== "pending") {
      throw new Error("payment_not_submittable");
    }
    if (payment.receipt_path) {
      throw new Error("duplicate_receipt");
    }

    const { data: updated, error } = await admin
      .from("payments")
      .update({
        receipt_path: receiptPath,
        receipt_mime_type: receiptMimeType,
        submitted_at: now,
        payment_status: "pending_review",
      })
      .eq("id", paymentId)
      .eq("payment_status", "pending")
      .is("receipt_path", null)
      .select("id")
      .maybeSingle();

    if (error) throw new Error("receipt_save_failed");
    if (!updated) throw new Error("duplicate_receipt");

    await logPaymentEvent({
      paymentId,
      eventType: "receipt_uploaded",
    });
    return { paymentId };
  }

  async activateAfterPayment(paymentId: string, actorId?: string) {
    const admin = createAdminClient();
    const now = new Date();

    const { data: payment } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .in("payment_status", ["pending", "pending_review"])
      .maybeSingle();

    if (!payment?.subscription_id) {
      throw new Error("payment_not_found");
    }

    const paymentProvider = resolvePaymentProvider();
    const verified = await paymentProvider.verifyPayment({ paymentId });
    if (!verified.success) {
      throw new Error("payment_verify_failed");
    }

    const expiresAt = addDays(now, SUBSCRIPTION_PERIOD_DAYS).toISOString();
    const nowIso = now.toISOString();

    // 1) Activate target subscription first — plan must never lag behind payment.
    const { data: subscription, error: activateError } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        starts_at: nowIso,
        expires_at: expiresAt,
        updated_at: nowIso,
      })
      .eq("id", payment.subscription_id)
      .select("plan_id, provider_id")
      .single();

    if (activateError || !subscription) throw new Error("subscription_not_found");

    // 2) Cancel every other open subscription for this provider.
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("provider_id", payment.provider_id)
      .neq("id", payment.subscription_id)
      .in("status", ["trial", "active", "pending_payment"]);

    const plan = await getPlanById(subscription.plan_id);
    const planSlug = (plan?.slug ?? "free") as PlanSlug;

    // 3) Sync provider benefits (featured / metadata) with the active plan.
    await applyPlanBenefits(subscription.provider_id, planSlug, expiresAt);

    // 4) Only then mark payment paid.
    const { error: paymentError } = await admin
      .from("payments")
      .update({
        payment_status: "paid",
        paid_at: nowIso,
        approved_at: nowIso,
        approved_by: actorId ?? null,
        external_transaction_id: verified.externalTransactionId ?? null,
      })
      .eq("id", paymentId)
      .in("payment_status", ["pending", "pending_review"]);

    if (paymentError) throw new Error("payment_update_failed");

    await logPaymentEvent({
      paymentId,
      eventType: "approved",
      actorId: actorId ?? null,
    });

    await createInvoiceForPayment(paymentId, payment.provider_id, Number(payment.amount), payment.currency);

    const owner = await getProviderOwnerEmailContext(payment.provider_id);
    if (owner?.email && (planSlug === "pro" || planSlug === "premium")) {
      await sendPlanActivatedEmail({
        to: owner.email,
        businessName: owner.businessName,
        planLabel: planSlug === "premium" ? "PREMIUM" : "PRO",
        amount: Number(payment.amount),
        currency: payment.currency,
        reference: payment.payment_reference,
        locale: owner.locale,
      });
    }

    const { data: providerRow } = await admin
      .from("providers")
      .select("slug")
      .eq("id", subscription.provider_id)
      .maybeSingle();

    return {
      providerId: subscription.provider_id,
      providerSlug: providerRow?.slug ?? null,
      planSlug,
      actorId,
      startsAt: nowIso,
      expiresAt,
    };
  }

  async rejectPayment(paymentId: string, actorId?: string, adminNote?: string) {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: payment } = await admin
      .from("payments")
      .select("id, subscription_id, provider_id, payment_status, amount, currency, payment_reference")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) throw new Error("payment_not_found");

    let planSlug: PlanSlug = "pro";
    if (payment.subscription_id) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("plan_id")
        .eq("id", payment.subscription_id)
        .maybeSingle();
      if (sub?.plan_id) {
        const plan = await getPlanById(sub.plan_id);
        planSlug = (plan?.slug ?? "pro") as PlanSlug;
      }
    }

    await admin
      .from("payments")
      .update({
        payment_status: "rejected",
        rejected_at: now,
        rejected_by: actorId ?? null,
        admin_note: adminNote?.trim() || null,
      })
      .eq("id", paymentId);

    await logPaymentEvent({
      paymentId,
      eventType: "rejected",
      actorId: actorId ?? null,
      note: adminNote?.trim() || null,
    });

    if (payment.subscription_id) {
      await admin
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", payment.subscription_id)
        .eq("status", "pending_payment");
    }

    await ensureFreeSubscription(payment.provider_id);
    const remaining = await getCurrentSubscription(payment.provider_id);
    const remainingSlug = (remaining?.planSlug ?? "free") as PlanSlug;
    await applyPlanBenefits(
      payment.provider_id,
      remainingSlug,
      remaining?.expiresAt ?? null,
    );

    const owner = await getProviderOwnerEmailContext(payment.provider_id);
    if (owner?.email) {
      await sendPaymentRejectedEmail({
        to: owner.email,
        businessName: owner.businessName,
        planLabel: planSlug === "premium" ? "PREMIUM" : "PRO",
        amount: Number(payment.amount),
        currency: payment.currency,
        reference: payment.payment_reference,
        adminNote: adminNote?.trim() || undefined,
        locale: owner.locale,
      });
    }

    const { data: providerRow } = await admin
      .from("providers")
      .select("slug")
      .eq("id", payment.provider_id)
      .maybeSingle();

    return { providerId: payment.provider_id, providerSlug: providerRow?.slug ?? null };
  }

  async expireDueSubscriptions() {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: expired } = await admin
      .from("subscriptions")
      .select("provider_id, id")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .lt("expires_at", now);

    for (const row of expired ?? []) {
      await admin.from("subscriptions").update({ status: "expired" }).eq("id", row.id);
      await this.downgrade(row.provider_id);
    }

    return (expired ?? []).length;
  }

  async adminChangePlan(providerId: string, planSlug: PlanSlug, extendDays = SUBSCRIPTION_PERIOD_DAYS) {
    const plan = await getPlanBySlug(planSlug);
    if (!plan) throw new Error("invalid_plan");

    const admin = createAdminClient();
    const now = new Date();
    const expiresAt = planSlug === "free" ? null : addDays(now, extendDays).toISOString();

    await admin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("provider_id", providerId)
      .in("status", ["trial", "active", "pending_payment"]);

    await admin.from("subscriptions").insert({
      provider_id: providerId,
      plan_id: plan.id,
      status: "active",
      starts_at: now.toISOString(),
      expires_at: expiresAt,
      auto_renew: planSlug !== "free",
    });

    await applyPlanBenefits(providerId, planSlug, expiresAt);
  }

  async adminExtendSubscription(providerId: string, days: number) {
    const current = await getCurrentSubscription(providerId);
    if (!current) throw new Error("no_subscription");

    const base = current.expiresAt ? new Date(current.expiresAt) : new Date();
    const expiresAt = addDays(base, days).toISOString();

    const admin = createAdminClient();
    await admin.from("subscriptions").update({ expires_at: expiresAt }).eq("id", current.id);
    await applyPlanBenefits(providerId, current.planSlug as PlanSlug, expiresAt);
  }
}

export const subscriptionService = new SubscriptionService();
