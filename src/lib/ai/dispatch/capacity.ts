import { clamp01 } from "@/lib/ai/types";
import type { CapacityEstimate } from "@/lib/ai/dispatch/types";

const DEFAULT_BREAK_MINUTES = 45;
const DEFAULT_TRAVEL_BUFFER_PER_JOB = 20;
const DEFAULT_JOB_MINUTES = 60;

/**
 * Estimate remaining daily capacity. Overloaded providers are skipped in dispatch.
 */
export function estimateCapacity(input: {
  workingMinutes: number;
  bookedMinutes: number;
  bookingCount: number;
  estimatedJobMinutes?: number;
  breakMinutes?: number;
}): CapacityEstimate {
  const estimatedJobMinutes = input.estimatedJobMinutes ?? DEFAULT_JOB_MINUTES;
  const breakMinutes =
    input.workingMinutes > 0
      ? (input.breakMinutes ?? DEFAULT_BREAK_MINUTES)
      : 0;
  const travelBufferMinutes =
    input.bookingCount * DEFAULT_TRAVEL_BUFFER_PER_JOB;
  const remainingMinutes = Math.max(
    0,
    input.workingMinutes - breakMinutes - input.bookedMinutes - travelBufferMinutes,
  );
  const overloaded = remainingMinutes < estimatedJobMinutes;

  return {
    workingMinutes: Math.max(0, input.workingMinutes),
    bookedMinutes: Math.max(0, input.bookedMinutes),
    travelBufferMinutes,
    breakMinutes,
    remainingMinutes,
    estimatedJobMinutes,
    overloaded,
  };
}

/** Soft capacity score 0–1 for ranking (1 = plenty of room). */
export function capacityScore(capacity: CapacityEstimate): number {
  if (capacity.overloaded) return 0;
  if (capacity.workingMinutes <= 0) return 0.45; // unknown hours → neutral-low
  return clamp01(capacity.remainingMinutes / Math.max(capacity.estimatedJobMinutes * 3, 1));
}

export function parseTimeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

export function workingMinutesFromHours(input: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}): number {
  if (input.isClosed || !input.opensAt || !input.closesAt) return 0;
  const open = parseTimeToMinutes(input.opensAt);
  const close = parseTimeToMinutes(input.closesAt);
  if (open == null || close == null || close <= open) return 0;
  return close - open;
}

export function isNowWithinHours(input: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  now?: Date;
}): boolean {
  if (input.isClosed || !input.opensAt || !input.closesAt) return false;
  const now = input.now ?? new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const open = parseTimeToMinutes(input.opensAt);
  const close = parseTimeToMinutes(input.closesAt);
  if (open == null || close == null) return false;
  return mins >= open && mins <= close;
}
