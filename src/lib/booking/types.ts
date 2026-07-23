/** Sprint 37–38 — Booking domain types */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "rescheduled"
  | "expired"
  | "awaiting_customer_confirmation"
  | "customer_confirmed"
  | "issue_reported";

export type BookingDurationMinutes = 15 | 30 | 60 | 90 | 120;

export const BOOKING_DURATIONS: BookingDurationMinutes[] = [15, 30, 60, 90, 120];

export type PreferredContact = "chat" | "phone" | "whatsapp";

export type BookingIssueReason =
  | "provider_never_arrived"
  | "provider_cancelled"
  | "work_incomplete"
  | "poor_quality"
  | "need_another_visit"
  | "other";

export const BOOKING_ISSUE_REASONS: BookingIssueReason[] = [
  "provider_never_arrived",
  "provider_cancelled",
  "work_incomplete",
  "poor_quality",
  "need_another_visit",
  "other",
];

export type Booking = {
  id: string;
  providerId: string;
  customerId: string;
  serviceId: string | null;
  serviceRequestId: string | null;
  conversationId: string | null;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  durationMinutes: BookingDurationMinutes;
  timezone: string;
  locationText: string | null;
  locationLat: number | null;
  locationLng: number | null;
  customerNotes: string | null;
  providerNotes: string | null;
  preferredContact: PreferredContact | null;
  requiresProviderConfirmation: boolean;
  customerName?: string | null;
  serviceName?: string | null;
  providerName?: string | null;
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  customerConfirmedAt: string | null;
  completionPromptedAt: string | null;
  issueReason: BookingIssueReason | null;
  issueReportedAt: string | null;
};

export type TimeSlot = {
  startsAt: string;
  endsAt: string;
  durationMinutes: BookingDurationMinutes;
};

export type AvailabilitySettings = {
  providerId: string;
  timezone: string;
  slotDurations: BookingDurationMinutes[];
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  emergencyAvailable: boolean;
  acceptingBookings: boolean;
};

export type BlockedTime = {
  id: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  kind: "blocked" | "vacation" | "holiday" | "manual";
};

export type BookingAiExtension =
  | "appointment_suggestions"
  | "estimated_repair_duration"
  | "workload_balancing"
  | "schedule_optimization";
