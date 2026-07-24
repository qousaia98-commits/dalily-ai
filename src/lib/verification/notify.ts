/**
 * Instant in-app verification notifications — reuses notify_marketplace_user.
 * Does not change approval workflows.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { VerificationAdminFeedback } from "@/lib/verification/feedback";
import { feedbackToPlainReason } from "@/lib/verification/feedback";

export type VerificationNotifyKind =
  | "approved"
  | "rejected"
  | "changes_requested";

const KEYS: Record<
  VerificationNotifyKind,
  { type: string; titleKey: string; bodyKey: string }
> = {
  approved: {
    type: "verification_approved",
    titleKey: "notifications.verificationApproved.title",
    bodyKey: "notifications.verificationApproved.body",
  },
  rejected: {
    type: "verification_rejected",
    titleKey: "notifications.verificationRejected.title",
    bodyKey: "notifications.verificationRejected.body",
  },
  changes_requested: {
    type: "verification_changes_requested",
    titleKey: "notifications.verificationChangesRequested.title",
    bodyKey: "notifications.verificationChangesRequested.body",
  },
};

export async function notifyProviderVerificationEvent(input: {
  ownerId: string;
  kind: VerificationNotifyKind;
  feedback?: VerificationAdminFeedback | null;
  href?: string;
}): Promise<void> {
  const keys = KEYS[input.kind];
  const admin = createAdminClient();
  const reason = input.feedback ? feedbackToPlainReason(input.feedback) : "";

  try {
    await admin.rpc("notify_marketplace_user", {
      p_user_id: input.ownerId,
      p_type: keys.type,
      p_title_key: keys.titleKey,
      p_body_key: keys.bodyKey,
      p_body_params: {
        reason: reason || "",
        note: input.feedback?.note ?? "",
        recommendation: input.feedback?.recommendation ?? "",
      },
      p_href: input.href ?? "/business/verification",
      p_request_id: null,
      p_conversation_id: null,
    });
  } catch {
    /* soft — never block admin review on notify failure */
  }
}

export const VERIFICATION_NOTIFICATION_TYPES = [
  "verification_approved",
  "verification_rejected",
  "verification_changes_requested",
] as const;
