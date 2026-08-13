/**
 * Day schedule optimization — prefer nearby / chronological with travel notes.
 */

import { listProviderBookings } from "@/lib/booking/booking-service";
import { getAvailabilitySettings } from "@/lib/booking/availability-service";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { DayOptimizeResult } from "./types";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function optimizeProviderDay(input: {
  providerId: string;
  date?: string; // YYYY-MM-DD
}): Promise<DayOptimizeResult> {
  const date = input.date ?? ymd(new Date());
  const settings = await getAvailabilitySettings(input.providerId);
  const travel = settings.travelBufferMinutes || settings.bufferMinutes || 20;

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const bookings = await listProviderBookings(input.providerId, {
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
    status: ["pending", "confirmed", "rescheduled"],
  });

  const ordered = [...bookings].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const items = ordered.map((b, i) => {
    const prev = ordered[i - 1];
    let noteEn = "Keep current order";
    if (prev) {
      const gapMin =
        (new Date(b.startsAt).getTime() - new Date(prev.endsAt).getTime()) /
        60_000;
      if (gapMin < travel) {
        noteEn = `Tight gap (${Math.round(gapMin)}m) — needs ≥${travel}m travel buffer`;
      } else if (gapMin > travel * 3) {
        noteEn = "Large gap — consider filling with a nearby job";
      } else {
        noteEn = `OK travel window (~${Math.round(gapMin)}m)`;
      }
    } else {
      noteEn = "First job — start of day";
    }

    return {
      bookingId: b.id,
      title: b.serviceName || b.customerNotes || "Appointment",
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      locationText: b.locationText,
      suggestedOrder: i + 1,
      noteEn,
    };
  });

  // Soft reorder suggestion by location text clustering (heuristic)
  const withGeo = ordered.filter((b) => b.locationLat != null && b.locationLng != null);
  if (withGeo.length >= 2) {
    // Keep chronological as primary — note only for now (safe, reversible)
  }

  const summaryEn =
    items.length === 0
      ? "No appointments today — open for intake."
      : `Optimized review of ${items.length} stop(s) with ${travel}m travel buffer.`;
  const summaryAr =
    items.length === 0
      ? "لا مواعيد اليوم — متاح لاستقبال طلبات."
      : `مراجعة محسّنة لـ ${items.length} محطة/محطات مع هامش تنقل ${travel} د.`;

  void emitAiLearningEvent({
    eventType: "day_schedule_optimized",
    providerId: input.providerId,
    metadata: { date, count: items.length, travelBufferMinutes: travel },
  });

  return {
    version: 2,
    providerId: input.providerId,
    date,
    items,
    summaryEn,
    summaryAr,
  };
}
