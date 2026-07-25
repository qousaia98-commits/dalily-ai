"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isBusinessUser, isAdminUser } from "@/lib/auth/roles";
import {
  isUnlockDevBypassEnabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";
import {
  completeUnlockSuccess,
  declineUnlockSession,
  getUnlockSessionById,
} from "@/domains/unlock/session";

export type UnlockActionState = {
  success: boolean;
  error?: string;
  grantId?: string;
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
 * Temporary audited manual confirm (Sprint 5 bridge until Sprint 6 charge).
 * Admin/moderator only — creates grant fail-closed without subscription activation.
 */
export async function adminConfirmUnlockAction(
  sessionId: string,
): Promise<UnlockActionState> {
  if (!isUnlockV2Enabled()) return { success: false, error: "feature_disabled" };
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
  // Session already opens in payment_pending; this is an explicit ack UI no-op success.
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
