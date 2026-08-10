"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  isProviderMonetizationEnabled,
  isUnlockPaymentsV2Enabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { completeUnlockSuccess, getUnlockSessionById } from "@/domains/unlock/session";
import {
  createUnlockFeePayment,
  type UnlockFeePaymentView,
} from "@/domains/payment/unlock-fee";
import {
  consumeIncludedUnlock,
  getBillingSettings,
  getMonetizationDashboard,
  updateBillingSettings,
  writeMonetizationAudit,
  type MonetizationBillingSettings,
  type MonetizationDashboard,
} from "@/lib/monetization";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateOrderSurfaces } from "@/lib/orders/revalidate";

function revalidateUnlock(sessionId: string, serviceRequestId?: string | null) {
  revalidateOrderSurfaces(serviceRequestId);
  revalidatePath(`/business/unlock/${sessionId}`);
  revalidatePath("/business/unlock");
  revalidatePath("/business/monetization");
  revalidatePath("/business");
}

/**
 * Unlock with Business included credit OR start pay-per-lead payment.
 */
export async function unlockLeadAction(sessionId: string): Promise<{
  success: boolean;
  error?: string;
  method?: "included" | "pay_per_lead";
  grantId?: string;
  payment?: UnlockFeePaymentView;
  remainingIncluded?: number;
}> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };

  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const session = await getUnlockSessionById(sessionId);
  if (!session || session.providerId !== provider.id) {
    return { success: false, error: "forbidden" };
  }
  if (!["opened", "payment_pending"].includes(session.status)) {
    return { success: false, error: "invalid_status" };
  }

  void emitAiLearningEvent({
    eventType: "lead_unlock_started",
    providerId: provider.id,
    serviceRequestId: session.serviceRequestId,
    metadata: { anonymized: true, sessionId },
  });

  // Flat subscription model: no pay-per-lead — grant immediately (unlimited leads).
  if (isProviderMonetizationEnabled()) {
    const result = await completeUnlockSuccess({
      sessionId,
      actorUserId: authUser.id,
      mode: "subscription_flat",
    });
    if (!result.ok) return { success: false, error: result.error };

    void consumeIncludedUnlock({
      providerId: provider.id,
      unlockSessionId: sessionId,
      actorUserId: authUser.id,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    await admin
      .from("unlock_sessions")
      .update({
        unlock_method: "subscription",
        fee_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    void emitAiLearningEvent({
      eventType: "lead_unlock_included",
      providerId: provider.id,
      serviceRequestId: session.serviceRequestId,
      metadata: { anonymized: true, method: "subscription_flat" },
    });

    revalidateUnlock(sessionId, session.serviceRequestId);
    return {
      success: true,
      method: "included",
      grantId: result.grantId,
    };
  }

  if (!isUnlockPaymentsV2Enabled()) {
    return { success: false, error: "payments_disabled" };
  }

  const payment = await createUnlockFeePayment({
    unlockSessionId: sessionId,
    providerId: provider.id,
  });
  if (!payment.ok) return { success: false, error: payment.error };

  void emitAiLearningEvent({
    eventType: "lead_unlock_paid",
    providerId: provider.id,
    serviceRequestId: session.serviceRequestId,
    metadata: {
      anonymized: true,
      amount: payment.payment.amount,
      currency: payment.payment.currency,
    },
  });

  revalidateUnlock(sessionId, session.serviceRequestId);
  return {
    success: true,
    method: "pay_per_lead",
    payment: payment.payment,
  };
}

export async function getMonetizationDashboardAction(): Promise<
  | { ok: true; dashboard: MonetizationDashboard }
  | { ok: false; error: string }
> {
  if (!isProviderMonetizationEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };
  const dashboard = await getMonetizationDashboard(provider.id);
  return { ok: true, dashboard };
}

export async function upgradeBusinessPlanAction(): Promise<{
  success: boolean;
  error?: string;
  checkoutUrl?: string;
  payment?: {
    paymentId: string;
    reference: string;
    amount: number;
    currency: string;
    paymentProvider: string;
    status: string;
    hasReceipt: boolean;
    receiver: string;
    account: string;
    swift?: string;
    bankName?: string;
    checkoutUrl?: string;
  };
}> {
  if (!isProviderMonetizationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  // Plan activates only after verified payment (Stripe webhook, Cham Cash auto-verify, or admin approve).
  const { startBusinessSubscriptionPayment, getActiveBusinessSubscriptionPayment } =
    await import("@/lib/payment/business-subscription");

  const existing = await getActiveBusinessSubscriptionPayment(provider.id);
  if (existing) {
    revalidatePath("/business/monetization");
    revalidatePath("/business/subscription");
    return {
      success: true,
      checkoutUrl: existing.checkoutUrl,
      payment: existing,
    };
  }

  const started = await startBusinessSubscriptionPayment({
    providerId: provider.id,
    actorUserId: authUser.id,
    renewal: false,
  });
  if (!started.ok) {
    return { success: false, error: started.error };
  }

  void emitAiLearningEvent({
    eventType: "subscription_payment_started",
    providerId: provider.id,
    metadata: { anonymized: true, paymentId: started.paymentId },
  });

  revalidatePath("/business/monetization");
  revalidatePath("/business/payments/history");
  revalidatePath("/business/subscription");
  revalidatePath("/business");
  return {
    success: true,
    checkoutUrl: started.checkoutUrl,
    payment: {
      paymentId: started.paymentId,
      reference: started.reference,
      amount: started.amount,
      currency: started.currency,
      paymentProvider: started.paymentProvider,
      status: "pending",
      hasReceipt: false,
      receiver: started.instructions?.receiver ?? "",
      account: started.instructions?.account ?? "",
      swift: started.instructions?.swift,
      bankName: started.instructions?.bankName,
      checkoutUrl: started.checkoutUrl,
    },
  };
}

/** Start a renewal payment for an active Business plan (new period). */
export async function renewBusinessPlanAction(): Promise<{
  success: boolean;
  error?: string;
  payment?: {
    paymentId: string;
    reference: string;
    amount: number;
    currency: string;
    paymentProvider: string;
    status: string;
    hasReceipt: boolean;
    receiver: string;
    account: string;
    swift?: string;
    bankName?: string;
  };
}> {
  if (!isProviderMonetizationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const {
    startBusinessSubscriptionPayment,
    getActiveBusinessSubscriptionPayment,
  } = await import("@/lib/payment/business-subscription");

  const existing = await getActiveBusinessSubscriptionPayment(provider.id);
  if (existing) {
    return { success: true, payment: existing };
  }

  const started = await startBusinessSubscriptionPayment({
    providerId: provider.id,
    actorUserId: authUser.id,
    renewal: true,
  });
  if (!started.ok) return { success: false, error: started.error };

  revalidatePath("/business/monetization");
  revalidatePath("/business/payments/history");
  revalidatePath("/business/subscription");
  return {
    success: true,
    payment: {
      paymentId: started.paymentId,
      reference: started.reference,
      amount: started.amount,
      currency: started.currency,
      paymentProvider: started.paymentProvider,
      status: "pending",
      hasReceipt: false,
      receiver: started.instructions?.receiver ?? "",
      account: started.instructions?.account ?? "",
      swift: started.instructions?.swift,
      bankName: started.instructions?.bankName,
    },
  };
}

/**
 * Provider pastes their Cham Cash transaction id for a pending
 * business_subscription payment. Verifies it automatically via the
 * shamcash provider; on success activates the plan immediately (no admin
 * wait). If verification can't confirm it (API not integrated yet,
 * network error, mismatch), returns an error so the UI can offer the
 * manual receipt-upload fallback instead.
 */
export async function submitChamCashTransactionAction(
  paymentId: string,
  transactionId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isProviderMonetizationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const trimmed = transactionId.trim();
  if (!trimmed) return { success: false, error: "transaction_id_required" };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, provider_id, purpose, payment_provider, payment_status")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment || payment.provider_id !== provider.id) {
    return { success: false, error: "forbidden" };
  }
  if (payment.purpose !== "business_subscription" || payment.payment_provider !== "shamcash") {
    return { success: false, error: "invalid_payment" };
  }
  if (payment.payment_status !== "pending" && payment.payment_status !== "pending_review") {
    return { success: false, error: "payment_not_submittable" };
  }

  const { resolveAdapter } = await import("@/domains/payment/providers/registry");
  const verified = await resolveAdapter("shamcash").verifyPayment({
    paymentId,
    externalTransactionId: trimmed,
  });
  if (!verified.success) {
    return { success: false, error: "verification_unavailable" };
  }

  const { activateBusinessSubscriptionFromPayment } = await import(
    "@/lib/payment/business-subscription"
  );
  const activated = await activateBusinessSubscriptionFromPayment({
    paymentId,
    actorUserId: authUser.id,
    source: "webhook",
  });
  if (!activated.ok) {
    return { success: false, error: activated.error };
  }

  void emitAiLearningEvent({
    eventType: "subscription_payment_activated",
    providerId: provider.id,
    metadata: { anonymized: true, paymentId, provider: "shamcash" },
  });

  revalidatePath("/business/monetization");
  revalidatePath("/business/payments/history");
  revalidatePath("/business/subscription");
  revalidatePath("/business");
  return { success: true };
}

/**
 * Admin approve of a business_subscription payment receipt.
 * Activates/renews via upgradeToBusinessPlan — not the legacy PlanSlug path.
 */
export async function approveBusinessSubscriptionPaymentAction(
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireAdminUser();
  if (
    !isProviderMonetizationEnabled() &&
    !isUnlockPaymentsV2Enabled()
  ) {
    return { success: false, error: "feature_disabled" };
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, purpose")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment || payment.purpose !== "business_subscription") {
    return { success: false, error: "not_business_subscription" };
  }

  const { activateBusinessSubscriptionFromPayment } = await import(
    "@/lib/payment/business-subscription"
  );
  const activated = await activateBusinessSubscriptionFromPayment({
    paymentId,
    actorUserId: authUser.id,
    source: "admin_approval",
  });
  if (!activated.ok) return { success: false, error: activated.error };

  await writeMonetizationAudit({
    eventKey: "business_subscription_payment_approved",
    actorUserId: authUser.id,
    payload: { paymentId, renewed: activated.renewed },
  });

  const { logAdminAudit } = await import("@/lib/admin/audit");
  await logAdminAudit({
    actorId: authUser.id,
    action: "payment_approved",
    entityType: "payment",
    entityId: paymentId,
    metadata: {
      purpose: "business_subscription",
      renewed: activated.renewed,
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/business/subscription");
  revalidatePath("/business/monetization");
  revalidatePath("/business/payments/history");
  return { success: true };
}

/**
 * Admin reject of a business_subscription payment receipt.
 */
export async function rejectBusinessSubscriptionPaymentAction(
  paymentId: string,
  adminNote?: string,
): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireAdminUser();
  if (
    !isProviderMonetizationEnabled() &&
    !isUnlockPaymentsV2Enabled()
  ) {
    return { success: false, error: "feature_disabled" };
  }

  const note = adminNote?.trim().slice(0, 1000) || undefined;

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, purpose")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment || payment.purpose !== "business_subscription") {
    return { success: false, error: "not_business_subscription" };
  }

  const { transitionPaymentStatus } = await import(
    "@/lib/payment/orchestration"
  );
  const rejected = await transitionPaymentStatus({
    paymentId,
    toStatus: "rejected",
    actorUserId: authUser.id,
    source: "admin",
    note: note || "admin_rejected",
  });
  if (!rejected.ok) return { success: false, error: rejected.error };

  await admin
    .from("payments")
    .update({
      rejected_at: new Date().toISOString(),
      rejected_by: authUser.id,
      admin_note: note || null,
    })
    .eq("id", paymentId);

  await writeMonetizationAudit({
    eventKey: "business_subscription_payment_rejected",
    actorUserId: authUser.id,
    payload: { paymentId, note: note ?? null },
  });

  const { logAdminAudit } = await import("@/lib/admin/audit");
  await logAdminAudit({
    actorId: authUser.id,
    action: "payment_rejected",
    entityType: "payment",
    entityId: paymentId,
    metadata: {
      purpose: "business_subscription",
      note: note ?? null,
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/business/subscription");
  revalidatePath("/business/monetization");
  revalidatePath("/business/payments/history");
  return { success: true };
}

export async function getAdminBillingSettingsAction(): Promise<
  | { ok: true; settings: MonetizationBillingSettings }
  | { ok: false; error: string }
> {
  await requireAdminUser();
  if (!isProviderMonetizationEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  return { ok: true, settings: await getBillingSettings() };
}

export async function saveAdminBillingSettingsAction(
  patch: Partial<Omit<MonetizationBillingSettings, "id">>,
): Promise<
  | { ok: true; settings: MonetizationBillingSettings }
  | { ok: false; error: string }
> {
  const admin = await requireAdminUser();
  if (!isProviderMonetizationEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const settings = await updateBillingSettings(patch, admin.id);
  await writeMonetizationAudit({
    eventKey: "monetization_settings_changed",
    actorUserId: admin.id,
    payload: patch as Record<string, unknown>,
  });
  void emitAiLearningEvent({
    eventType: "monetization_settings_changed",
    metadata: { anonymized: true },
  });
  revalidatePath("/admin/monetization");
  return { ok: true, settings };
}

/** Admin override: extend / activate without a receipt (comps, refunds, goodwill). */
export async function adminMarkProviderSubscriptionPaidAction(input: {
  providerId: string;
  months?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdminUser();
  if (!isProviderMonetizationEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const providerId = input.providerId?.trim();
  if (!providerId || !/^[0-9a-f-]{36}$/i.test(providerId)) {
    return { ok: false, error: "invalid_provider" };
  }
  const months = Math.min(24, Math.max(1, Math.floor(input.months ?? 1)));

  const { upgradeToBusinessPlan } = await import("@/lib/monetization");
  await upgradeToBusinessPlan({
    providerId,
    actorUserId: admin.id,
    months,
  });

  await writeMonetizationAudit({
    eventKey: "admin_marked_subscription_paid",
    actorUserId: admin.id,
    providerId,
    payload: { months },
  });

  revalidatePath("/admin/monetization");
  revalidatePath("/business/subscription");
  revalidatePath("/business/monetization");
  return { ok: true };
}
