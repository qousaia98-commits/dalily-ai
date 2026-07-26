/**
 * Sprint 4 Phase 2 — Smart Booking & AI Scheduling.
 */

export type {
  AppointmentType,
  SuggestedSlot,
  SmartSlotSuggestions,
  DayOptimizeResult,
  SlotSuggestInput,
} from "./types";

export { APPOINTMENT_TYPES } from "./types";
export { suggestSmartSlots } from "./suggest-slots";
export { optimizeProviderDay } from "./day-optimize";
export { processSmartBookingReminders } from "./reminders";

export const smartBookingModule = {
  id: "smart_booking",
  status: "sprint4_phase2" as const,
  impl: [
    "src/lib/booking/smart/suggest-slots.ts",
    "src/lib/booking/smart/day-optimize.ts",
    "src/lib/booking/smart/reminders.ts",
  ],
  future: ["video consultation media", "live traffic ETA", "multi-day optimizer"],
};
