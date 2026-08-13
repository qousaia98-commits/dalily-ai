/**
 * Collect schedule raw signals from bookings + capacity.
 */

import { listProviderBookings } from "@/lib/booking/booking-service";
import { getAvailabilitySettings } from "@/lib/booking/availability-service";
import { getProviderCapacity } from "@/lib/matching-engine/capacity";
import type {
  ScheduleRawSignals,
  ScheduleStop,
} from "@/lib/scheduling-engine/types";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function collectScheduleRaw(input: {
  providerId: string;
  scheduleDate?: string;
  mlScheduleFactor?: number | null;
}): Promise<ScheduleRawSignals> {
  const scheduleDate = input.scheduleDate ?? ymd(new Date());
  const dayStart = new Date(`${scheduleDate}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [bookings, settings, capacity] = await Promise.all([
    listProviderBookings(input.providerId, {
      from: dayStart.toISOString(),
      to: dayEnd.toISOString(),
      status: ["pending", "confirmed", "rescheduled"],
    }),
    getAvailabilitySettings(input.providerId),
    getProviderCapacity(input.providerId),
  ]);

  const stops: ScheduleStop[] = bookings.map((b) => {
    const durationMin = Math.max(
      15,
      Math.round(
        (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60_000,
      ),
    );
    return {
      bookingId: b.id,
      title: b.serviceName || b.customerNotes || "Appointment",
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      lat: b.locationLat,
      lng: b.locationLng,
      locationText: b.locationText,
      durationMin,
      urgency01: 0.2,
      categoryKey: null,
    };
  });

  const maxDaily = capacity?.maxDailyJobs ?? 6;
  const jobsToday = capacity?.jobsToday ?? stops.length;
  const fatigue01 = Math.min(
    1,
    (capacity?.workloadScore ?? stops.length / maxDaily) * 0.9,
  );

  return {
    providerId: input.providerId,
    scheduleDate,
    stops,
    workingHoursStart: 8,
    workingHoursEnd: 18,
    maxDailyJobs: maxDaily,
    maxWeeklyJobs: maxDaily * 5,
    jobsToday,
    vacationMode: Boolean(capacity?.vacationMode),
    pauseMode: Boolean(capacity?.pauseMode),
    fatigue01,
    traffic01: 0,
    weather01: 0,
    prepMinutes: 10,
    cleanupMinutes: 10,
    breakPreferredHour: 13,
    mlScheduleFactor: input.mlScheduleFactor ?? null,
  };
}
