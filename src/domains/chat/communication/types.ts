/**
 * Sprint 10 Phase 3 — Enterprise Communication types (public-safe).
 */

export const COMMUNICATION_SYSTEM_EVENTS = [
  "offer_received",
  "offer_accepted",
  "booking_confirmed",
  "booking_cancelled",
  "provider_arrived",
  "job_started",
  "job_completed",
  "review_requested",
  "payment_initiated",
  "payment_authorized",
  "payment_reserved",
  "payment_released",
  "payment_refunded",
  "payment_completed",
  "dispute_opened",
  "chat_opened",
  "contact_unlocked",
] as const;

export type CommunicationSystemEvent =
  (typeof COMMUNICATION_SYSTEM_EVENTS)[number];

export const COMMUNICATION_TIMELINE_STEPS = [
  "offer",
  "acceptance",
  "appointment",
  "arrival",
  "completion",
  "review",
  "payment",
] as const;

export type CommunicationTimelineStep =
  (typeof COMMUNICATION_TIMELINE_STEPS)[number];

export type CommunicationTimelineItem = {
  step: CommunicationTimelineStep;
  status: "done" | "current" | "upcoming" | "skipped";
  at: string | null;
  labelKey: string;
};

export type MessageReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type ChatReportReason =
  | "spam"
  | "harassment"
  | "fraud"
  | "inappropriate"
  | "other";

export type TranslationTargetLocale = "ar" | "en" | "de";

/** AI-ready translation payload — never replaces original body. */
export type MessageTranslationView = {
  messageId: string;
  locale: TranslationTargetLocale;
  translatedText: string;
  provider: "none" | "ai" | "cache";
  originalPreserved: true;
};

export type ConversationSafetySettings = {
  muted: boolean;
  blockedPeer: boolean;
  moderationStatus: "active" | "suspended" | "under_review";
};
