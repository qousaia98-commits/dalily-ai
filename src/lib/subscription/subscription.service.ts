import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePaymentProvider } from "@/lib/payment/payment.service";
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

  if (planSlug === "premium") {
    await admin
      .from("providers")
      .update({
        metadata: { subscription_plan: planSlug },
        is_featured: true,
        featured_until: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId);
  } else {
    await admin
      .from("providers")
      .update({
        metadata: { subscription_plan: planSlug },
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
    const targetPlan = await getPlanBySlug(targetPlanSlug);
    if (!targetPlan || targetPlan.slug === "free") {
      throw new Error("invalid_plan");
    }

    const current = await this.getStatus(providerId);
    const amount =
      billingCycle === "yearly" ? targetPlan.yearlyPriceUsd : targetPlan.monthlyPriceUsd;

    const admin = createAdminClient();

    if (current && current.status === "active" && current.planSlug === targetPlanSlug) {
      throw new Error("already_on_plan");
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
    const result = await paymentProvider.createPayment({
      providerId,
      subscriptionId: subscription.id,
      amount,
      currency: "USD",
      reference: `SUB-${subscription.id.slice(0, 8).toUpperCase()}`,
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

  async activateAfterPayment(paymentId: string, actorId?: string) {
    const admin = createAdminClient();
    const now = new Date();

    const { data: payment } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("payment_status", "pending")
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

    await admin
      .from("payments")
      .update({
        payment_status: "paid",
        paid_at: now.toISOString(),
        external_transaction_id: verified.externalTransactionId ?? null,
      })
      .eq("id", paymentId);

    await admin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("provider_id", payment.provider_id)
      .neq("id", payment.subscription_id)
      .in("status", ["trial", "active", "pending_payment"]);

    const { data: subscription } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        starts_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", payment.subscription_id)
      .select("plan_id, provider_id")
      .single();

    if (!subscription) throw new Error("subscription_not_found");

    const plan = await getPlanById(subscription.plan_id);
    await applyPlanBenefits(subscription.provider_id, (plan?.slug ?? "free") as PlanSlug, expiresAt);
    await createInvoiceForPayment(paymentId, payment.provider_id, Number(payment.amount), payment.currency);

    return { providerId: subscription.provider_id, planSlug: plan?.slug, actorId };
  }

  async rejectPayment(paymentId: string) {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("subscription_id")
      .eq("id", paymentId)
      .maybeSingle();

    await resolvePaymentProvider().cancelPayment(paymentId);

    if (payment?.subscription_id) {
      await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", payment.subscription_id)
        .eq("status", "pending_payment");
    }
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
