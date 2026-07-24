/**
 * Instant in-app verification notifications.
 * Uses direct admin insert (service role) — RPC auth.uid() blocks service-role calls.
 * Does not change approval workflows.
 */

import type { VerificationAdminFeedback } from "@/lib/verification/feedback";
import { feedbackToPlainReason } from "@/lib/verification/feedback";
import { deliverMarketplaceNotification } from "@/lib/notifications/deliver";

export type VerificationNotifyKind =
  | "approved"
  | "rejected"
  | "changes_requested"
  | "resubmitted";

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
  resubmitted: {
    type: "verification_resubmitted",
    titleKey: "notifications.verificationResubmitted.title",
    bodyKey: "notifications.verificationResubmitted.body",
  },
};

export async function notifyProviderVerificationEvent(input: {
  ownerId: string;
  kind: VerificationNotifyKind;
  feedback?: VerificationAdminFeedback | null;
  href?: string;
}): Promise<void> {
  const keys = KEYS[input.kind];
  const reason = input.feedback ? feedbackToPlainReason(input.feedback) : "";

  await deliverMarketplaceNotification({
    userId: input.ownerId,
    type: keys.type,
    titleKey: keys.titleKey,
    bodyKey: keys.bodyKey,
    bodyParams: {
      reason: reason || "",
      note: input.feedback?.note ?? "",
      recommendation: input.feedback?.recommendation ?? "",
    },
    href: input.href ?? "/business/verification",
  });
}

export const VERIFICATION_NOTIFICATION_TYPES = [
  "verification_approved",
  "verification_rejected",
  "verification_changes_requested",
  "verification_resubmitted",
] as const;
