"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isBusinessUser, isAdminUser } from "@/lib/auth/roles";
import {
  isUnlockDevBypassEnabled,
  isUnlockPaymentsV2Enabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";
import {
  completeUnlockSuccess,
  declineUnlockSession,
  getUnlockSessionById,
} from "@/domains/unlock/session";
import {
  cancelUnlockFeePayment,
  createUnlockFeePayment,
  getActiveUnlockFeePayment,
  type UnlockFeePaymentView,
} from "@/domains/payment/unlock-fee";

export type UnlockActionState = {
  success: boolean;
  error?: string;
  grantId?: string;
  payment?: UnlockFeePaymentView;
};

export async function confirmUnlockDevBypassAction(
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };
  if (!isUnlockDevBypassEnabled()) return { success: false, error: "bypass_forbidden" };

  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const session = await getUnlockSessionById(sessionId);
  if (!session || session.providerId !== provider.id) {
    return { success: false, error: "forbidden" };
  }

  const result = await completeUnlockSuccess({
    sessionId,
    actorUserId: authUser.id,
    mode: "dev_bypass",
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/business/unlock/${sessionId}`);
  revalidatePath(`/request/${session.serviceRequestId}/waiting`);
  return { success: true, grantId: result.grantId };
}

/**
 * Sprint 5 bridge — disabled when UNLOCK_PAYMENTS_V2 is on (use admin payment approve).
 */
export async function adminConfirmUnlockAction(
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };
  if (isUnlockPaymentsV2Enabled()) {
    return { success: false, error: "payment_required" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  if (!isAdminUser(authUser.roles)) return { success: false, error: "forbidden" };

  const session = await getUnlockSessionById(sessionId);
  if (!session) return { success: false, error: "session_not_found" };

  const result = await completeUnlockSuccess({
    sessionId,
    actorUserId: authUser.id,
    mode: "manual_confirm",
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/business/unlock/${sessionId}`);
  revalidatePath(`/request/${session.serviceRequestId}/waiting`);
  return { success: true, grantId: result.grantId };
}

export async function startUnlockFeePaymentAction(
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };
  if (!isUnlockPaymentsV2Enabled()) return { success: false, error: "payments_disabled" };

  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const result = await createUnlockFeePayment({
    unlockSessionId: sessionId,
    providerId: provider.id,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/business/unlock/${sessionId}`);
  return { success: true, payment: result.payment };
}

export async function cancelUnlockFeePaymentAction(
  paymentId: string,
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockPaymentsV2Enabled()) return { success: false, error: "payments_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const result = await cancelUnlockFeePayment({
    paymentId,
    providerId: provider.id,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/business/unlock/${sessionId}`);
  return { success: true };
}

export async function getUnlockFeePaymentAction(
  sessionId: string,
): Promise<UnlockFeePaymentView | null> {
  if (!isUnlockPaymentsV2Enabled()) return null;
  return getActiveUnlockFeePayment(sessionId);
}

export async function declineUnlockAction(
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const result = await declineUnlockSession({
    sessionId,
    providerId: provider.id,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath("/business/unlock");
  revalidatePath(`/business/unlock/${sessionId}`);
  return { success: true };
}

export async function providerMarkPaymentPendingAction(
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser || !isBusinessUser(authUser.roles)) {
    return { success: false, error: "forbidden" };
  }
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };
  const session = await getUnlockSessionById(sessionId);
  if (!session || session.providerId !== provider.id) {
    return { success: false, error: "forbidden" };
  }
  if (!["opened", "payment_pending"].includes(session.status)) {
    return { success: false, error: "invalid_status" };
  }
  return { success: true };
}
