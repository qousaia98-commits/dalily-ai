/**
 * Soft verification UI status + timeline — derived from existing provider/verification fields.
 * No business-logic / workflow changes.
 */

import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import {
  mergeVerificationFeedbackSources,
  type VerificationAdminFeedback,
  type VerificationUiStatus,
} from "@/lib/verification/feedback";

export type VerificationTimelineEventId =
  | "registered"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "resubmitted"
  | "approved"
  | "rejected";

export type VerificationTimelineEvent = {
  id: VerificationTimelineEventId;
  at: string | null;
  current: boolean;
  note?: string | null;
};

export function resolveVerificationUiStatus(
  provider: Pick<ManagedProvider, "status" | "verificationStatus">,
  verification: Pick<BusinessVerificationView, "status">,
): VerificationUiStatus {
  if (
    provider.verificationStatus === "verified" ||
    verification.status === "approved" ||
    provider.status === "active"
  ) {
    return "approved";
  }
  if (provider.status === "changes_requested") return "changes_requested";
  // Keep showing rejected until the provider finishes resubmit (provider.verificationStatus flips on submit).
  if (
    provider.verificationStatus === "rejected" ||
    verification.status === "rejected"
  ) {
    return "rejected";
  }
  if (
    provider.status === "pending_review" ||
    verification.status === "pending"
  ) {
    return "pending_review";
  }
  return "draft";
}

export function resolveVerificationFeedback(
  provider: Pick<ManagedProvider, "adminReviewNote">,
  verification: Pick<BusinessVerificationView, "rejectionReason">,
): VerificationAdminFeedback | null {
  return mergeVerificationFeedbackSources(
    verification.rejectionReason,
    provider.adminReviewNote,
  );
}

export function shouldShowVerificationDashboardAlert(
  status: VerificationUiStatus,
): boolean {
  return status !== "approved";
}

/** True while the alert is actionable / informative for the provider. */
export function isVerificationAlertRelevant(status: VerificationUiStatus): boolean {
  return (
    status === "draft" ||
    status === "pending_review" ||
    status === "rejected" ||
    status === "changes_requested"
  );
}

export function buildVerificationTimeline(input: {
  provider: ManagedProvider;
  verification: BusinessVerificationView & { createdAt?: string | null; updatedAt?: string | null };
  feedback?: VerificationAdminFeedback | null;
}): VerificationTimelineEvent[] {
  const { provider, verification, feedback } = input;
  const status = resolveVerificationUiStatus(provider, verification);
  const note = feedback ? [feedback.reason, feedback.note].filter(Boolean).join(" — ") : null;

  const events: VerificationTimelineEvent[] = [
    {
      id: "registered",
      at: provider.createdAt,
      current: false,
    },
  ];

  const submittedAt =
    verification.createdAt ||
    (verification.idFrontUploaded || verification.idBackUploaded || verification.selfieUploaded
      ? verification.reviewedAt
      : null);

  if (verification.id || provider.status !== "draft" || verification.status) {
    events.push({
      id: "submitted",
      at: submittedAt ?? provider.createdAt,
      current: false,
    });
  }

  if (
    status === "pending_review" ||
    status === "approved" ||
    status === "rejected" ||
    status === "changes_requested"
  ) {
    events.push({
      id: "under_review",
      at: submittedAt ?? provider.changesRequestedAt ?? verification.reviewedAt,
      current: status === "pending_review",
    });
  }

  if (provider.changesRequestedAt || status === "changes_requested") {
    events.push({
      id: "changes_requested",
      at: provider.changesRequestedAt,
      current: status === "changes_requested",
      note: note ?? provider.adminReviewNote,
    });
  }

  // Resubmit: docs updated after a prior review/rejection (or pending after re-upload).
  const looksLikeResubmit =
    Boolean(verification.updatedAt) &&
    (Boolean(verification.reviewedAt) ||
      provider.verificationStatus === "rejected" ||
      status === "pending_review") &&
    verification.updatedAt !== verification.createdAt;

  if (
    looksLikeResubmit &&
    (status === "pending_review" || status === "rejected" || status === "changes_requested")
  ) {
    const resubmitAt =
      verification.updatedAt &&
      verification.reviewedAt &&
      verification.updatedAt > verification.reviewedAt
        ? verification.updatedAt
        : verification.updatedAt;
    events.push({
      id: "resubmitted",
      at: resubmitAt,
      current: false,
    });
  }

  if (status === "pending_review" && looksLikeResubmit) {
    // Ensure "under review" is current after resubmit.
    const underReview = events.find((e) => e.id === "under_review");
    if (underReview) {
      underReview.current = true;
      underReview.at = verification.updatedAt ?? underReview.at;
    }
  }

  if (status === "approved") {
    events.push({
      id: "approved",
      at: verification.reviewedAt,
      current: true,
    });
  }

  if (status === "rejected") {
    events.push({
      id: "rejected",
      at: verification.reviewedAt,
      current: true,
      note: note ?? verification.rejectionReason,
    });
  }

  return events;
}
