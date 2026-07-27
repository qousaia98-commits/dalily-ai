/**
 * Opportunity planner — suggest nearby compatible jobs for idle gaps.
 * Never creates schedule conflicts; provider decides.
 */

import { haversineKm } from "@/lib/geo/distance";
import { fitsGapWithoutConflict } from "@/lib/scheduling-engine/gaps";
import type {
  ScheduleGap,
  ScheduleOpportunity,
  ScheduleStop,
} from "@/lib/scheduling-engine/types";

export type OpportunityCandidate = {
  requestId?: string | null;
  titleEn: string;
  titleAr?: string;
  lat: number | null;
  lng: number | null;
  expectedEarnings: number;
  expectedDurationMin: number;
  matchingScore: number;
  demand01?: number;
  reputation01?: number;
  skillsFit01?: number;
  currency?: string;
};

function anchorNearGap(
  stops: ScheduleStop[],
  gap: ScheduleGap,
): { lat: number; lng: number } | null {
  const before = [...stops]
    .filter((s) => new Date(s.endsAt).getTime() <= new Date(gap.startsAt).getTime())
    .sort(
      (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
    )[0];
  if (before?.lat != null && before.lng != null) {
    return { lat: before.lat, lng: before.lng };
  }
  const geo = stops.find((s) => s.lat != null && s.lng != null);
  if (geo?.lat != null && geo.lng != null) return { lat: geo.lat, lng: geo.lng };
  return null;
}

export function scoreOpportunities(input: {
  stops: ScheduleStop[];
  gaps: ScheduleGap[];
  candidates: OpportunityCandidate[];
  bufferMin?: number;
}): ScheduleOpportunity[] {
  const out: ScheduleOpportunity[] = [];

  for (const gap of input.gaps) {
    const anchor = anchorNearGap(input.stops, gap);
    for (const c of input.candidates) {
      let distanceKm = 5;
      if (anchor && c.lat != null && c.lng != null) {
        distanceKm = haversineKm(anchor.lat, anchor.lng, c.lat, c.lng);
      }
      const travelMinutes = Math.round(distanceKm * 2.5);
      if (
        !fitsGapWithoutConflict({
          gap,
          jobDurationMin: c.expectedDurationMin,
          travelInMin: travelMinutes,
          travelOutMin: Math.round(travelMinutes * 0.8),
          bufferMin: input.bufferMin,
        })
      ) {
        continue;
      }

      const distanceScore = Math.max(0, 1 - distanceKm / 20);
      const earnScore = Math.min(1, c.expectedEarnings / 300_000);
      const match = c.matchingScore;
      const demand = c.demand01 ?? 0.5;
      const rep = c.reputation01 ?? 0.6;
      const skills = c.skillsFit01 ?? 0.7;
      const opportunityScore =
        Math.round(
          (distanceScore * 0.25 +
            earnScore * 0.2 +
            match * 0.25 +
            demand * 0.1 +
            rep * 0.1 +
            skills * 0.1) *
            1000,
        ) / 1000;

      const completion = new Date(
        new Date(gap.startsAt).getTime() +
          (travelMinutes + c.expectedDurationMin) * 60_000,
      ).toISOString();

      out.push({
        titleEn: c.titleEn,
        titleAr: c.titleAr,
        distanceKm: Math.round(distanceKm * 10) / 10,
        travelMinutes,
        expectedEarnings: c.expectedEarnings,
        expectedDurationMin: c.expectedDurationMin,
        matchingScore: match,
        opportunityScore,
        expectedCompletion: completion,
        currency: c.currency ?? "SYP",
        requestId: c.requestId ?? null,
        gapStartsAt: gap.startsAt,
        gapEndsAt: gap.endsAt,
      });
    }
  }

  return out
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 8);
}

/** Demo/synthetic candidates when marketplace feed empty — advisory placeholders */
export function syntheticGapCandidates(
  gaps: ScheduleGap[],
): OpportunityCandidate[] {
  if (!gaps.length) return [];
  return [
    {
      titleEn: "Nearby urgent repair",
      titleAr: "إصلاح عاجل قريب",
      lat: null,
      lng: null,
      expectedEarnings: 180_000,
      expectedDurationMin: 60,
      matchingScore: 0.82,
      demand01: 0.7,
      reputation01: 0.75,
      skillsFit01: 0.85,
    },
    {
      titleEn: "Repeat customer follow-up",
      titleAr: "متابعة لعميل متكرر",
      lat: null,
      lng: null,
      expectedEarnings: 120_000,
      expectedDurationMin: 45,
      matchingScore: 0.9,
      demand01: 0.55,
      reputation01: 0.8,
      skillsFit01: 0.9,
    },
    {
      titleEn: "High-value install window",
      titleAr: "نافذة تركيب عالية القيمة",
      lat: null,
      lng: null,
      expectedEarnings: 250_000,
      expectedDurationMin: 90,
      matchingScore: 0.7,
      demand01: 0.65,
      reputation01: 0.7,
      skillsFit01: 0.75,
    },
  ];
}
