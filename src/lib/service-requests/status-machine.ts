import type { Database } from "@/types/database.types";

export type ServiceRequestStatus = Database["public"]["Enums"]["service_request_status"];

export type TimelineStepId =
  | "request_sent"
  | "under_review"
  | "accepted"
  | "quote_sent"
  | "quote_accepted"
  | "chat_active"
  | "service_completed"
  | "customer_confirmed"
  | "reviewed";

export type TimelineStepState = "done" | "current" | "upcoming" | "skipped";

export type TimelineStep = {
  id: TimelineStepId;
  state: TimelineStepState;
};

/** Ordered premium timeline steps shown to both parties */
export const TIMELINE_STEPS: readonly TimelineStepId[] = [
  "request_sent",
  "under_review",
  "accepted",
  "quote_sent",
  "quote_accepted",
  "chat_active",
  "service_completed",
  "customer_confirmed",
  "reviewed",
] as const;

const CHAT_UNLOCKED: ReadonlySet<ServiceRequestStatus> = new Set([
  "accepted",
  "quoted",
  "quote_accepted",
  "quote_declined",
  "in_progress",
  "completed_by_business",
  "completed",
  "disputed",
]);

const TERMINAL: ReadonlySet<ServiceRequestStatus> = new Set([
  "rejected",
  "cancelled",
  "reviewed",
]);

export function canChat(status: ServiceRequestStatus): boolean {
  return CHAT_UNLOCKED.has(status) && status !== "reviewed";
}

export function canReview(status: ServiceRequestStatus): boolean {
  return status === "completed";
}

export function canCompleteService(status: ServiceRequestStatus): boolean {
  return (
    status === "accepted" ||
    status === "quote_accepted" ||
    status === "quote_declined" ||
    status === "in_progress" ||
    status === "disputed"
  );
}

export function canSendQuote(status: ServiceRequestStatus): boolean {
  return status === "accepted" || status === "quote_declined";
}

export function canDecideQuote(status: ServiceRequestStatus): boolean {
  return status === "quoted";
}

export function canConfirmCompletion(status: ServiceRequestStatus): boolean {
  return status === "completed_by_business";
}

export function isTerminal(status: ServiceRequestStatus): boolean {
  return TERMINAL.has(status);
}

export function nextStepHint(status: ServiceRequestStatus, viewer: "customer" | "business"): string {
  switch (status) {
    case "pending":
      return viewer === "business" ? "next.reviewRequest" : "next.waitForReview";
    case "accepted":
      return viewer === "business" ? "next.sendQuoteOrChat" : "next.waitQuoteOrChat";
    case "quoted":
      return viewer === "customer" ? "next.decideQuote" : "next.waitQuoteDecision";
    case "quote_accepted":
    case "quote_declined":
    case "in_progress":
      return viewer === "business" ? "next.completeWhenDone" : "next.chatAndWait";
    case "completed_by_business":
      return viewer === "customer" ? "next.confirmOrReport" : "next.waitCustomerConfirm";
    case "completed":
      return viewer === "customer" ? "next.leaveReview" : "next.waitReview";
    case "disputed":
      return viewer === "business" ? "next.resolveDisputeBusiness" : "next.resolveDispute";
    case "reviewed":
      return "next.closed";
    case "rejected":
      return "next.rejected";
    case "cancelled":
      return "next.cancelled";
    default:
      return "next.generic";
  }
}

/**
 * Build visual timeline highlighting current step.
 * Optional quote steps skip when no quote was involved.
 */
export function buildTimeline(
  status: ServiceRequestStatus,
  opts?: { hasQuote?: boolean },
): TimelineStep[] {
  const hasQuote = opts?.hasQuote ?? false;

  if (status === "rejected" || status === "cancelled") {
    return TIMELINE_STEPS.map((id) => {
      if (id === "request_sent") return { id, state: "done" as const };
      if (id === "under_review") return { id, state: "current" as const };
      return { id, state: "skipped" as const };
    });
  }

  const currentIndex = statusToTimelineIndex(status, hasQuote);

  return TIMELINE_STEPS.map((id, index) => {
    // Skip quote steps if never quoted and past acceptance without quote path
    if (
      !hasQuote &&
      (id === "quote_sent" || id === "quote_accepted") &&
      currentIndex > timelineIndexOf("accepted")
    ) {
      if (index < currentIndex) return { id, state: "skipped" };
    }

    if (index < currentIndex) return { id, state: "done" };
    if (index === currentIndex) return { id, state: "current" };
    return { id, state: "upcoming" };
  });
}

function timelineIndexOf(id: TimelineStepId): number {
  return TIMELINE_STEPS.indexOf(id);
}

function statusToTimelineIndex(status: ServiceRequestStatus, hasQuote: boolean): number {
  switch (status) {
    case "pending":
      return timelineIndexOf("under_review");
    case "accepted":
      return timelineIndexOf("accepted");
    case "quoted":
      return timelineIndexOf("quote_sent");
    case "quote_declined":
      return timelineIndexOf("quote_sent");
    case "quote_accepted":
      return timelineIndexOf("quote_accepted");
    case "in_progress":
      return timelineIndexOf("chat_active");
    case "completed_by_business":
      return timelineIndexOf("service_completed");
    case "completed":
    case "disputed":
      return timelineIndexOf("customer_confirmed");
    case "reviewed":
      return timelineIndexOf("reviewed");
    default:
      return hasQuote ? timelineIndexOf("chat_active") : timelineIndexOf("accepted");
  }
}

export const BUSINESS_REQUEST_TABS = [
  "pending",
  "accepted",
  "quoted",
  "in_progress",
  "completed",
  "rejected",
  "disputed",
] as const;

export type BusinessRequestTab = (typeof BUSINESS_REQUEST_TABS)[number];

/** Map tab filter → statuses included */
export function statusesForTab(tab: BusinessRequestTab): ServiceRequestStatus[] {
  switch (tab) {
    case "pending":
      return ["pending"];
    case "accepted":
      return ["accepted", "quote_declined"];
    case "quoted":
      return ["quoted"];
    case "in_progress":
      return ["quote_accepted", "in_progress", "completed_by_business"];
    case "completed":
      return ["completed", "reviewed"];
    case "rejected":
      return ["rejected", "cancelled"];
    case "disputed":
      return ["disputed"];
    default:
      return [];
  }
}
