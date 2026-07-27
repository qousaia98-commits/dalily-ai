/**
 * Route optimization — shortest path heuristic (nearest-neighbor).
 * Future-ready: traffic, road closures, EV charging.
 */

import { haversineKm } from "@/lib/geo/distance";
import type { ScheduleStop } from "@/lib/scheduling-engine/types";

export type RoutePlan = {
  ordered: ScheduleStop[];
  totalDistanceKm: number;
  totalTravelMin: number;
  stopOrder: string[];
  travelReductionMin: number;
  fuelReductionKm: number;
};

function travelMinForKm(km: number, traffic01 = 0): number {
  return km * (2.5 + traffic01 * 1.2);
}

/** Chronological baseline travel */
function baselineTravel(stops: ScheduleStop[], traffic01: number): {
  km: number;
  min: number;
} {
  const ordered = [...stops].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  let km = 0;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1];
    const b = ordered[i];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      km += haversineKm(a.lat, a.lng, b.lat, b.lng);
    }
  }
  return { km, min: travelMinForKm(km, traffic01) };
}

/**
 * Nearest-neighbor reorder among geo stops; keep non-geo in chronological slots.
 * Never invent conflicts — times stay as booked; order is a recommendation only.
 */
export function optimizeRoute(
  stops: ScheduleStop[],
  traffic01 = 0,
): RoutePlan {
  if (stops.length <= 1) {
    return {
      ordered: [...stops],
      totalDistanceKm: 0,
      totalTravelMin: 0,
      stopOrder: stops.map((s) => s.bookingId),
      travelReductionMin: 0,
      fuelReductionKm: 0,
    };
  }

  const base = baselineTravel(stops, traffic01);
  const geo = stops.filter((s) => s.lat != null && s.lng != null);
  const noGeo = stops.filter((s) => s.lat == null || s.lng == null);

  let ordered: ScheduleStop[] = [];
  if (geo.length >= 2) {
    const remaining = [...geo];
    // Start with earliest geo stop
    remaining.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
    let current = remaining.shift()!;
    ordered.push(current);
    while (remaining.length) {
      let bestIdx = 0;
      let bestKm = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i];
        const km = haversineKm(
          current.lat!,
          current.lng!,
          c.lat!,
          c.lng!,
        );
        if (km < bestKm) {
          bestKm = km;
          bestIdx = i;
        }
      }
      current = remaining.splice(bestIdx, 1)[0]!;
      ordered.push(current);
    }
    // Merge non-geo chronologically by start time into recommendation list end
    ordered = [...ordered, ...noGeo].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  } else {
    ordered = [...stops].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  let km = 0;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1];
    const b = ordered[i];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      km += haversineKm(a.lat, a.lng, b.lat, b.lng);
    }
  }
  const min = travelMinForKm(km, traffic01);

  return {
    ordered,
    totalDistanceKm: Math.round(km * 10) / 10,
    totalTravelMin: Math.round(min),
    stopOrder: ordered.map((s) => s.bookingId),
    travelReductionMin: Math.max(0, Math.round(base.min - min)),
    fuelReductionKm: Math.max(0, Math.round((base.km - km) * 10) / 10),
  };
}
