import type { EtaWindow } from "@/lib/ai/dispatch/types";
import type { RouteFit } from "@/lib/ai/dispatch/types";

/** Urban Syria heuristic speed km/h — traffic-ready architecture (swap later). */
const TRAVEL_SPEED_KMH = 22;

/**
 * Estimate arrival window from distance, schedule gap, and working hours.
 */
export function estimateEta(input: {
  distanceKm: number | null;
  routeFit: RouteFit;
  isWithinWorkingHours: boolean;
  estimatedResponseHours: number | null;
  now?: Date;
}): EtaWindow {
  const now = input.now ?? new Date();

  if (!input.isWithinWorkingHours) {
    return {
      minutesMin: null,
      minutesMax: null,
      labelEn: "Tomorrow morning",
      kind: "tomorrow_morning",
    };
  }

  if (input.distanceKm == null) {
    const hours = input.estimatedResponseHours ?? 2;
    if (hours <= 1) {
      return {
        minutesMin: 30,
        minutesMax: 60,
        labelEn: "30–60 minutes",
        kind: "minutes",
      };
    }
    return {
      minutesMin: null,
      minutesMax: null,
      labelEn: slotLabel(now, hours),
      kind: "today_slot",
    };
  }

  const travelMin = Math.max(8, Math.round((input.distanceKm / TRAVEL_SPEED_KMH) * 60));
  let prep = 15;
  if (input.routeFit.fits && input.routeFit.gapMinutes != null) {
    prep = Math.min(prep, Math.max(5, input.routeFit.gapMinutes));
  }
  const min = travelMin + prep;
  const max = travelMin + prep + Math.max(10, Math.round(travelMin * 0.4));

  if (min <= 45) {
    return {
      minutesMin: min,
      minutesMax: max,
      labelEn: `${min}–${max} minutes`,
      kind: "minutes",
    };
  }

  return {
    minutesMin: min,
    minutesMax: max,
    labelEn: slotLabel(now, min / 60),
    kind: "today_slot",
  };
}

function slotLabel(now: Date, hoursAhead: number): string {
  const start = new Date(now.getTime() + hoursAhead * 3600000);
  const end = new Date(start.getTime() + 3600000);
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `Today ${fmt(start)}–${fmt(end)}`;
}
