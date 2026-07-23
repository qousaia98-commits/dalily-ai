import { createClient } from "@/lib/supabase/server";
import type {
  AvailabilitySettings,
  BlockedTime,
  BookingDurationMinutes,
} from "@/lib/booking/types";
import { BOOKING_DURATIONS } from "@/lib/booking/types";

const DEFAULT_SETTINGS = (providerId: string): AvailabilitySettings => ({
  providerId,
  timezone: "Asia/Damascus",
  slotDurations: [30, 60],
  bufferMinutes: 0,
  minNoticeHours: 2,
  maxDaysAhead: 60,
  emergencyAvailable: false,
  acceptingBookings: true,
});

export async function getAvailabilitySettings(
  providerId: string,
): Promise<AvailabilitySettings> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("provider_availability_settings")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS(providerId);

  const durations = ((data.slot_durations as number[]) ?? [30, 60]).filter((d) =>
    (BOOKING_DURATIONS as number[]).includes(d),
  ) as BookingDurationMinutes[];

  return {
    providerId,
    timezone: data.timezone ?? "Asia/Damascus",
    slotDurations: durations.length ? durations : [30, 60],
    bufferMinutes: data.buffer_minutes ?? 0,
    minNoticeHours: data.min_notice_hours ?? 2,
    maxDaysAhead: data.max_days_ahead ?? 60,
    emergencyAvailable: Boolean(data.emergency_available),
    acceptingBookings: data.accepting_bookings !== false,
  };
}

export async function upsertAvailabilitySettings(
  settings: AvailabilitySettings,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("provider_availability_settings").upsert({
    provider_id: settings.providerId,
    timezone: settings.timezone,
    slot_durations: settings.slotDurations,
    buffer_minutes: settings.bufferMinutes,
    min_notice_hours: settings.minNoticeHours,
    max_days_ahead: settings.maxDaysAhead,
    emergency_available: settings.emergencyAvailable,
    accepting_bookings: settings.acceptingBookings,
    updated_at: new Date().toISOString(),
  });
  if (error) return { success: false, error: "save_failed" };
  return { success: true };
}

export async function listBlockedTimes(
  providerId: string,
  fromIso: string,
  toIso: string,
): Promise<BlockedTime[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("provider_blocked_times")
    .select("id, provider_id, starts_at, ends_at, reason, kind")
    .eq("provider_id", providerId)
    .is("deleted_at", null)
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso)
    .order("starts_at", { ascending: true });

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    providerId: row.provider_id as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    reason: (row.reason as string) ?? null,
    kind: row.kind as BlockedTime["kind"],
  }));
}

export async function createBlockedTime(input: {
  providerId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  kind?: BlockedTime["kind"];
  createdBy: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("provider_blocked_times")
    .insert({
      provider_id: input.providerId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason ?? null,
      kind: input.kind ?? "blocked",
      created_by: input.createdBy,
    })
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: "create_failed" };
  return { success: true, id: data?.id as string };
}

export async function listBreaks(providerId: string): Promise<
  Array<{ id: string; dayOfWeek: number; startsAt: string; endsAt: string; label: string | null }>
> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("provider_availability_breaks")
    .select("id, day_of_week, starts_at, ends_at, label")
    .eq("provider_id", providerId);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    dayOfWeek: Number(row.day_of_week),
    startsAt: String(row.starts_at).slice(0, 5),
    endsAt: String(row.ends_at).slice(0, 5),
    label: (row.label as string) ?? null,
  }));
}
