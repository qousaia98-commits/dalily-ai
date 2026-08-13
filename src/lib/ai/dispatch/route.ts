import { haversineKm } from "@/lib/geo/distance";
import type { RouteFit } from "@/lib/ai/dispatch/types";

const NEARBY_JOB_KM = 1.2;
const MAX_GAP_MINUTES = 120;

/**
 * Prefer providers who already have a nearby scheduled job
 * (fill gaps / reduce deadhead travel).
 */
export function evaluateRouteFit(input: {
  requestLat: number | null;
  requestLng: number | null;
  bookings: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    lat: number | null;
    lng: number | null;
  }>;
  now?: Date;
}): RouteFit {
  const empty: RouteFit = {
    fits: false,
    nearbyBookingId: null,
    gapMinutes: null,
    distanceFromJobKm: null,
    labelEn: "No nearby scheduled jobs",
  };

  if (input.requestLat == null || input.requestLng == null) return empty;
  if (!input.bookings.length) return empty;

  const now = input.now ?? new Date();
  let best: RouteFit | null = null;

  for (const b of input.bookings) {
    if (b.lat == null || b.lng == null) continue;
    const dist = haversineKm(input.requestLat, input.requestLng, b.lat, b.lng);
    if (dist > NEARBY_JOB_KM) continue;

    const start = new Date(b.startsAt).getTime();
    const end = new Date(b.endsAt).getTime();
    const nowMs = now.getTime();
    // Gap after job ends, or before it starts.
    let gapMinutes: number | null = null;
    if (nowMs <= start) {
      gapMinutes = Math.round((start - nowMs) / 60000);
    } else if (nowMs <= end + MAX_GAP_MINUTES * 60000) {
      gapMinutes = Math.max(0, Math.round((nowMs - end) / 60000));
    } else {
      continue;
    }
    if (gapMinutes > MAX_GAP_MINUTES) continue;

    const candidate: RouteFit = {
      fits: true,
      nearbyBookingId: b.id,
      gapMinutes,
      distanceFromJobKm: Math.round(dist * 1000) / 1000,
      labelEn: `Fits near an existing job (${(Math.round(dist * 10) / 10).toFixed(1)} km, ~${gapMinutes} min gap)`,
    };
    if (
      !best ||
      (candidate.distanceFromJobKm ?? 99) < (best.distanceFromJobKm ?? 99)
    ) {
      best = candidate;
    }
  }

  return best ?? empty;
}

/** 0–1 boost for ranking. */
export function routeFitScore(fit: RouteFit): number {
  if (!fit.fits) return 0.4;
  const dist = fit.distanceFromJobKm ?? 1;
  const gap = fit.gapMinutes ?? 60;
  return Math.min(1, 0.55 + (1 - Math.min(dist, 1.2) / 1.2) * 0.3 + (1 - Math.min(gap, 120) / 120) * 0.15);
}
