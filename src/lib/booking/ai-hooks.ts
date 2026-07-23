/**
 * Future AI booking features — stubs only (Sprint 37).
 */

import type { BookingAiExtension } from "@/lib/booking/types";

export function listBookingAiExtensions(): BookingAiExtension[] {
  return [
    "appointment_suggestions",
    "estimated_repair_duration",
    "workload_balancing",
    "schedule_optimization",
  ];
}

export async function runBookingAiHook(
  extension: BookingAiExtension,
  _context: Record<string, unknown>,
): Promise<{ extension: BookingAiExtension; supported: false }> {
  void _context;
  return { extension, supported: false };
}
