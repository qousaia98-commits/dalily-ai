/**
 * Booking / job timeline derived from request status + system messages.
 * Pure presentation mapping — no ranking or private formulas.
 */

import type {
  CommunicationTimelineItem,
  CommunicationTimelineStep,
} from "./types";

type TimelineInput = {
  requestStatus: string | null;
  hasOfferSelected: boolean;
  hasBooking: boolean;
  bookingStartsAt: string | null;
  completedAt: string | null;
  hasReview: boolean;
  hasPayment: boolean;
  systemEvents: Array<{ eventType: string | null; createdAt: string }>;
};

function eventAt(
  events: TimelineInput["systemEvents"],
  codes: string[],
): string | null {
  for (const e of events) {
    if (e.eventType && codes.includes(e.eventType)) return e.createdAt;
  }
  return null;
}

function statusFor(
  step: CommunicationTimelineStep,
  done: boolean,
  current: boolean,
  skipped = false,
): CommunicationTimelineItem["status"] {
  if (skipped) return "skipped";
  if (done) return "done";
  if (current) return "current";
  return "upcoming";
}

export function buildCommunicationTimeline(
  input: TimelineInput,
): CommunicationTimelineItem[] {
  const st = input.requestStatus ?? "";
  const offerDone = input.hasOfferSelected || [
    "quote_accepted",
    "accepted",
    "in_progress",
    "completed_by_business",
    "completed",
    "reviewed",
    "customer_confirmed",
  ].includes(st);

  const appointmentDone =
    input.hasBooking ||
    Boolean(input.bookingStartsAt) ||
    ["in_progress", "completed_by_business", "completed", "reviewed"].includes(st);

  const arrivalDone = Boolean(
    eventAt(input.systemEvents, ["provider_arrived", "job_started"]) ||
      ["in_progress", "completed_by_business", "completed", "reviewed"].includes(st),
  );

  const completionDone =
    Boolean(input.completedAt) ||
    ["completed", "completed_by_business", "reviewed", "customer_confirmed"].includes(
      st,
    );

  const reviewDone = input.hasReview || st === "reviewed";
  const paymentDone = input.hasPayment;

  const steps: Array<{
    step: CommunicationTimelineStep;
    done: boolean;
    at: string | null;
    skipped?: boolean;
  }> = [
    {
      step: "offer",
      done: offerDone || input.systemEvents.some((e) => e.eventType === "offer_received"),
      at: eventAt(input.systemEvents, ["offer_received", "offer_accepted"]),
    },
    {
      step: "acceptance",
      done: offerDone,
      at: eventAt(input.systemEvents, ["offer_accepted", "chat_opened", "contact_unlocked"]),
    },
    {
      step: "appointment",
      done: appointmentDone,
      at: input.bookingStartsAt ?? eventAt(input.systemEvents, ["booking_confirmed"]),
    },
    {
      step: "arrival",
      done: arrivalDone,
      at: eventAt(input.systemEvents, ["provider_arrived", "job_started"]),
    },
    {
      step: "completion",
      done: completionDone,
      at: input.completedAt ?? eventAt(input.systemEvents, ["job_completed"]),
    },
    {
      step: "review",
      done: reviewDone,
      at: eventAt(input.systemEvents, ["review_requested"]),
    },
    {
      step: "payment",
      done: paymentDone,
      at: eventAt(input.systemEvents, [
        "payment_completed",
        "payment_released",
        "payment_reserved",
        "payment_authorized",
        "payment_initiated",
      ]),
      skipped: !paymentDone && !completionDone ? false : !paymentDone && completionDone,
    },
  ];

  let foundCurrent = false;
  return steps.map((s) => {
    let current = false;
    if (!s.done && !s.skipped && !foundCurrent) {
      current = true;
      foundCurrent = true;
    }
    return {
      step: s.step,
      status: statusFor(s.step, s.done, current, s.skipped),
      at: s.at,
      labelKey: `timeline.${s.step}`,
    };
  });
}
