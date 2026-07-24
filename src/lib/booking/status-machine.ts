import type { BookingStatus } from "@/lib/booking/types";

/**
 * Legal booking status transitions.
 * Terminal states (empty allow-list) must never transition again.
 */
export const BOOKING_STATUS_TRANSITIONS: Record<
  BookingStatus,
  readonly BookingStatus[]
> = {
  pending: ["confirmed", "declined", "cancelled", "expired", "rescheduled"],
  confirmed: [
    "cancelled",
    "rescheduled",
    "awaiting_customer_confirmation",
    "issue_reported",
    "customer_confirmed",
    "completed",
  ],
  rescheduled: ["confirmed", "cancelled", "declined", "rescheduled"],
  awaiting_customer_confirmation: [
    "customer_confirmed",
    "completed",
    "issue_reported",
    "cancelled",
    "rescheduled",
  ],
  customer_confirmed: ["completed"],
  /** Includes self for in-place issue reason updates. */
  issue_reported: [
    "awaiting_customer_confirmation",
    "customer_confirmed",
    "completed",
    "cancelled",
    "rescheduled",
    "issue_reported",
  ],
  declined: [],
  cancelled: [],
  completed: [],
  expired: [],
};

export function isBookingTransitionAllowed(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}
