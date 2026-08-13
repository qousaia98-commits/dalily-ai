/** Sprint 4 Phase 2 — Smart Booking types */

import type { BookingDurationMinutes, TimeSlot } from "@/lib/booking/types";

export type AppointmentType =
  | "immediate"
  | "today"
  | "scheduled"
  | "recurring"
  | "emergency"
  | "video";

export const APPOINTMENT_TYPES: AppointmentType[] = [
  "immediate",
  "today",
  "scheduled",
  "recurring",
  "emergency",
  "video",
];

export type SuggestedSlot = TimeSlot & {
  rank: number;
  score: number;
  label: "recommended" | "alternative";
  reasonsEn: string[];
  reasonsAr: string[];
};

export type SmartSlotSuggestions = {
  version: 2;
  appointmentType: AppointmentType;
  travelBufferMinutes: number;
  recommended: SuggestedSlot | null;
  alternatives: SuggestedSlot[];
  allSlots: TimeSlot[];
};

export type DayOptimizeItem = {
  bookingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  locationText: string | null;
  suggestedOrder: number;
  noteEn: string;
};

export type DayOptimizeResult = {
  version: 2;
  providerId: string;
  date: string;
  items: DayOptimizeItem[];
  summaryEn: string;
  summaryAr: string;
};

export type SlotSuggestInput = {
  providerId: string;
  fromDate: string;
  durationMinutes: BookingDurationMinutes;
  days?: number;
  appointmentType?: AppointmentType;
  urgency?: "emergency" | "normal";
  customerLat?: number | null;
  customerLng?: number | null;
};
