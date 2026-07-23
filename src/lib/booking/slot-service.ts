/**
 * Incremental slot generation from working hours − breaks − blocks − existing bookings.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getAvailabilitySettings,
  listBlockedTimes,
  listBreaks,
} from "@/lib/booking/availability-service";
import type { BookingDurationMinutes, TimeSlot } from "@/lib/booking/types";
import type { WorkingHour } from "@/types/provider.types";

function parseTimeOnDate(dateYmd: string, hhmm: string, timeZone: string): Date {
  // Interpret local wall time in provider timezone approximately via ISO offsetless + label.
  // For V1 we treat stored hours as local Asia/Damascus wall clock (project default).
  void timeZone;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${dateYmd}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function ymdInLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function generateAvailableSlots(input: {
  providerId: string;
  fromDate: string; // YYYY-MM-DD
  days?: number;
  durationMinutes: BookingDurationMinutes;
}): Promise<TimeSlot[]> {
  const supabase = await createClient();
  const settings = await getAvailabilitySettings(input.providerId);
  if (!settings.acceptingBookings && !settings.emergencyAvailable) return [];

  const duration = input.durationMinutes;
  if (!settings.slotDurations.includes(duration) && !settings.emergencyAvailable) {
    return [];
  }

  const days = Math.min(input.days ?? 14, settings.maxDaysAhead);
  const from = new Date(`${input.fromDate}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + days);

  const { data: hoursRows } = await supabase
    .from("provider_working_hours")
    .select("*")
    .eq("provider_id", input.providerId);

  const hours: WorkingHour[] = (hoursRows ?? []).map((r) => ({
    dayOfWeek: r.day_of_week,
    opensAt: r.opens_at ? String(r.opens_at).slice(0, 5) : null,
    closesAt: r.closes_at ? String(r.closes_at).slice(0, 5) : null,
    isClosed: Boolean(r.is_closed),
  }));

  const breaks = await listBreaks(input.providerId);
  const blocked = await listBlockedTimes(
    input.providerId,
    from.toISOString(),
    to.toISOString(),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings } = await (supabase as any)
    .from("bookings")
    .select("starts_at, ends_at, status")
    .eq("provider_id", input.providerId)
    .is("deleted_at", null)
    .in("status", ["pending", "confirmed", "rescheduled"])
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());

  const busy = (
    (bookings ?? []) as Array<{ starts_at: string; ends_at: string }>
  ).map((b) => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  const blockRanges = blocked.map((b) => ({
    start: new Date(b.startsAt),
    end: new Date(b.endsAt),
  }));

  const now = new Date();
  const minStart = new Date(now.getTime() + settings.minNoticeHours * 3600_000);
  const bufferMs = settings.bufferMinutes * 60_000;
  const slots: TimeSlot[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(from);
    day.setDate(from.getDate() + i);
    const dow = day.getDay(); // 0=Sun
    const ymd = ymdInLocal(day);
    const hour = hours.find((h) => h.dayOfWeek === dow);

    if (!hour || hour.isClosed || !hour.opensAt || !hour.closesAt) {
      if (!settings.emergencyAvailable) continue;
    }

    const open = parseTimeOnDate(
      ymd,
      hour?.opensAt && !hour.isClosed ? hour.opensAt : "09:00",
      settings.timezone,
    );
    const close = parseTimeOnDate(
      ymd,
      hour?.closesAt && !hour.isClosed ? hour.closesAt : "17:00",
      settings.timezone,
    );

    const dayBreaks = breaks
      .filter((b) => b.dayOfWeek === dow)
      .map((b) => ({
        start: parseTimeOnDate(ymd, b.startsAt, settings.timezone),
        end: parseTimeOnDate(ymd, b.endsAt, settings.timezone),
      }));

    let cursor = new Date(open);
    while (cursor.getTime() + duration * 60_000 <= close.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + duration * 60_000);

      if (slotStart < minStart) {
        cursor = new Date(cursor.getTime() + duration * 60_000);
        continue;
      }

      const paddedStart = new Date(slotStart.getTime() - bufferMs);
      const paddedEnd = new Date(slotEnd.getTime() + bufferMs);

      const hitBreak = dayBreaks.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
      const hitBlock = blockRanges.some((b) =>
        overlaps(paddedStart, paddedEnd, b.start, b.end),
      );
      const hitBusy = busy.some((b) => overlaps(paddedStart, paddedEnd, b.start, b.end));

      if (!hitBreak && !hitBlock && !hitBusy) {
        slots.push({
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString(),
          durationMinutes: duration,
        });
      }

      cursor = new Date(cursor.getTime() + duration * 60_000);
    }
  }

  return slots;
}
