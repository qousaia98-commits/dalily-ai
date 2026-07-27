/**
 * Scheduling engine — weighted signals + route/gap heuristics.
 * Advisory only — never auto-books.
 */

import { computeCapacitySnapshot } from "@/lib/scheduling-engine/capacity";
import {
  SCHEDULE_ADVISORY_NOTICE,
  buildScheduleExplanations,
} from "@/lib/scheduling-engine/explanations";
import { detectScheduleGaps, totalIdleMinutes } from "@/lib/scheduling-engine/gaps";
import { optimizeRoute } from "@/lib/scheduling-engine/routes";
import {
  ML_SCHEDULER_COLLECTOR,
  SCHEDULE_SIGNAL_COLLECTORS,
  type ScheduleSignalCollector,
} from "@/lib/scheduling-engine/signals";
import { DEFAULT_SCHEDULE_WEIGHTS } from "@/lib/scheduling-engine/weights";
import {
  SCHEDULE_ML_VERSION,
  SCHEDULE_MODEL_VERSION,
  type OptimizedStop,
  type ScheduleComputation,
  type ScheduleRawSignals,
  type ScheduleSignalResult,
  type ScheduleWeight,
} from "@/lib/scheduling-engine/types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function computeScheduleFromSignals(input: {
  raw: ScheduleRawSignals;
  weights?: ScheduleWeight[];
  collectors?: ScheduleSignalCollector[];
  includeMlLayer?: boolean;
  experimentId?: string | null;
  profileKey?: string;
  startedAt?: number;
}): ScheduleComputation {
  const started = input.startedAt ?? Date.now();
  const weights = input.weights ?? DEFAULT_SCHEDULE_WEIGHTS;
  const weightByKey = new Map(weights.map((w) => [w.signalKey, w]));
  let collectors = input.collectors ?? SCHEDULE_SIGNAL_COLLECTORS;

  if (
    input.includeMlLayer !== false &&
    input.raw.mlScheduleFactor != null &&
    Number(input.raw.mlScheduleFactor) > 0
  ) {
    collectors = [...collectors, ML_SCHEDULER_COLLECTOR];
    if (!weightByKey.has("ml_scheduler")) {
      weightByKey.set("ml_scheduler", {
        signalKey: "ml_scheduler",
        category: "ml",
        weight: 1,
        enabled: true,
        mlReady: true,
      });
    }
  }

  const signals: ScheduleSignalResult[] = [];
  let weighted = 0;
  let weightAbs = 0;
  let mlContribution = 0;

  for (const collector of collectors) {
    const w = weightByKey.get(collector.signalKey);
    if (!w || !w.enabled) continue;
    const computed = collector.computeScore(input.raw);
    const isMl = Boolean(computed.metadata?.ml);
    const contribution = computed.score * w.weight;
    signals.push({
      signalKey: collector.signalKey,
      category: collector.category,
      rawValue: computed.rawValue,
      score: computed.score,
      weight: w.weight,
      contribution,
      source: isMl ? "ml" : "rule",
    });
    weighted += contribution;
    weightAbs += Math.abs(w.weight);
    if (isMl) mlContribution += contribution;
  }

  const planQuality = weightAbs > 0 ? weighted / weightAbs : 0.5;

  const route = optimizeRoute(input.raw.stops, input.raw.traffic01);
  const gaps = detectScheduleGaps(route.ordered);
  const idleMinutes = totalIdleMinutes(gaps);
  const capacity = computeCapacitySnapshot(input.raw);

  const workSpanMin = Math.max(
    1,
    (input.raw.workingHoursEnd - input.raw.workingHoursStart) * 60,
  );
  const bookedMin = input.raw.stops.reduce((a, s) => a + s.durationMin, 0);
  const utilization = Math.min(
    1,
    (bookedMin + route.totalTravelMin) / workSpanMin,
  );

  const orderedStops: OptimizedStop[] = route.ordered.map((s, i) => {
    const start = new Date(s.startsAt);
    const dep = new Date(start.getTime() - 20 * 60_000);
    return {
      bookingId: s.bookingId,
      suggestedOrder: i + 1,
      suggestedDeparture: dep.toISOString(),
      arrivalWindowStart: new Date(start.getTime() - 10 * 60_000).toISOString(),
      arrivalWindowEnd: new Date(start.getTime() + 10 * 60_000).toISOString(),
      noteEn:
        i === 0
          ? "First stop — prepare departure"
          : `Suggested order ${i + 1} after clustering`,
    };
  });

  const first = route.ordered[0];
  const last = route.ordered[route.ordered.length - 1];
  const departureTime = first
    ? new Date(new Date(first.startsAt).getTime() - 25 * 60_000).toISOString()
    : null;
  const expectedFinish = last ? last.endsAt : null;

  const lunchHour = input.raw.breakPreferredHour;
  const lunchRecommendation = `Around ${pad(lunchHour)}:00–${pad(lunchHour + 1)}:00`;
  const breakSchedule =
    idleMinutes >= 30
      ? `Use a ${Math.min(45, Math.round(idleMinutes / 2))}m break in the largest gap`
      : "Protect a short mid-day break if capacity allows";

  const revenueForecast =
    input.raw.stops.length > 0
      ? Math.round(input.raw.stops.length * 150_000)
      : null;

  const opportunityScore = Math.min(
    1,
    planQuality * 0.35 +
      gaps.filter((g) => g.durationMinutes >= 45).length * 0.2 +
      capacity.remainingCapacity * 0.12,
  );

  const explanations = buildScheduleExplanations({
    raw: input.raw,
    travelMinutes: route.totalTravelMin,
    idleMinutes,
    burnoutRisk: capacity.burnoutRisk,
    utilization,
  });

  // Soft idle reduction estimate if gaps filled later
  const idleReductionMin = Math.min(idleMinutes, Math.round(idleMinutes * 0.35));

  return {
    scheduleDate: input.raw.scheduleDate,
    orderedStops,
    departureTime,
    expectedFinish,
    breakSchedule,
    lunchRecommendation,
    travelMinutes: route.totalTravelMin,
    idleMinutes,
    travelReductionMin: route.travelReductionMin,
    idleReductionMin,
    fuelReductionKm: route.fuelReductionKm,
    dailyUtilization: Math.round(utilization * 1000) / 1000,
    revenueForecast,
    explanations,
    algorithmVersion:
      mlContribution !== 0
        ? `${SCHEDULE_MODEL_VERSION}+${SCHEDULE_ML_VERSION}`
        : SCHEDULE_MODEL_VERSION,
    advisoryNotice: SCHEDULE_ADVISORY_NOTICE,
    signals,
    latencyMs: Date.now() - started,
    experimentId: input.experimentId ?? null,
    providerId: input.raw.providerId,
    profileKey: input.profileKey ?? "balanced-v1",
    burnoutRisk: capacity.burnoutRisk,
    opportunityScore: Math.round(opportunityScore * 1000) / 1000,
    overbookingRisk: capacity.overbookingRisk,
  };
}
