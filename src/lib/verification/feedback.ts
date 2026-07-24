/**
 * Verification feedback payload — stored in existing TEXT columns (no schema change).
 * Format: JSON object; plain strings remain backward-compatible.
 */

export type VerificationAdminFeedback = {
  reason: string;
  note?: string;
  recommendation?: string;
};

export type VerificationUiStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "expired";

const FEEDBACK_MARKER = '"reason"';

export function serializeVerificationFeedback(feedback: VerificationAdminFeedback): string {
  const payload: VerificationAdminFeedback = {
    reason: feedback.reason.trim(),
    ...(feedback.note?.trim() ? { note: feedback.note.trim() } : {}),
    ...(feedback.recommendation?.trim()
      ? { recommendation: feedback.recommendation.trim() }
      : {}),
  };
  return JSON.stringify(payload);
}

export function parseVerificationFeedback(
  raw: string | null | undefined,
): VerificationAdminFeedback | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  if (text.startsWith("{") && text.includes(FEEDBACK_MARKER)) {
    try {
      const parsed = JSON.parse(text) as Partial<VerificationAdminFeedback>;
      if (typeof parsed.reason === "string" && parsed.reason.trim()) {
        return {
          reason: parsed.reason.trim(),
          note: typeof parsed.note === "string" ? parsed.note.trim() : undefined,
          recommendation:
            typeof parsed.recommendation === "string"
              ? parsed.recommendation.trim()
              : undefined,
        };
      }
    } catch {
      /* fall through — treat as plain reason */
    }
  }
  return { reason: text };
}

export function feedbackDisplayLines(feedback: VerificationAdminFeedback | null): string[] {
  if (!feedback) return [];
  const lines = [feedback.reason];
  if (feedback.note) lines.push(feedback.note);
  if (feedback.recommendation) lines.push(feedback.recommendation);
  return lines;
}

export function feedbackToPlainReason(feedback: VerificationAdminFeedback): string {
  return feedbackDisplayLines(feedback).join("\n\n");
}

export function mergeVerificationFeedbackSources(
  rejectionReason: string | null | undefined,
  adminReviewNote: string | null | undefined,
): VerificationAdminFeedback | null {
  const fromRejection = parseVerificationFeedback(rejectionReason);
  const fromNote = parseVerificationFeedback(adminReviewNote);
  if (!fromRejection && !fromNote) return null;
  if (fromRejection && fromNote) {
    return {
      reason: fromRejection.reason || fromNote.reason,
      note: fromRejection.note || fromNote.note,
      recommendation: fromRejection.recommendation || fromNote.recommendation,
    };
  }
  return fromRejection ?? fromNote;
}
