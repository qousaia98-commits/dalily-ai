/**
 * Public scheduling explanations — advisory only.
 */

import type {
  PublicScheduleExplanation,
  ScheduleComputation,
  ScheduleRawSignals,
} from "@/lib/scheduling-engine/types";

export const SCHEDULE_ADVISORY_NOTICE =
  "Advisory schedule only — Dalily does not auto-book or force provider decisions.";

export function buildScheduleExplanations(input: {
  raw: ScheduleRawSignals;
  travelMinutes: number;
  idleMinutes: number;
  burnoutRisk: number;
  utilization: number;
}): PublicScheduleExplanation[] {
  const out: PublicScheduleExplanation[] = [];

  if (input.travelMinutes > 60) {
    out.push({
      code: "high_travel",
      labelEn: "Travel time is high — clustering stops may help.",
      labelAr: "وقت السفر مرتفع — تجميع المحطات قد يساعد.",
    });
  } else if (input.travelMinutes < 25 && input.raw.stops.length >= 2) {
    out.push({
      code: "efficient_route",
      labelEn: "Route looks efficient with low travel.",
      labelAr: "المسار يبدو فعالاً مع سفر منخفض.",
    });
  }

  if (input.idleMinutes >= 45 && input.idleMinutes <= 180) {
    out.push({
      code: "fillable_gap",
      labelEn: "Idle gaps detected — nearby jobs may fit.",
      labelAr: "فجوات خمول مكتشفة — وظائف قريبة قد تناسب.",
    });
  }

  if (input.burnoutRisk >= 0.65) {
    out.push({
      code: "burnout_risk",
      labelEn: "Burnout risk is elevated — protect break time.",
      labelAr: "خطر الإرهاق مرتفع — احمِ وقت الراحة.",
    });
  }

  if (input.utilization >= 0.85) {
    out.push({
      code: "high_utilization",
      labelEn: "Day utilization is high — avoid overbooking.",
      labelAr: "استغلال اليوم مرتفع — تجنّب الحجز الزائد.",
    });
  } else if (input.utilization <= 0.35 && input.raw.stops.length > 0) {
    out.push({
      code: "low_utilization",
      labelEn: "Capacity remains — opportunity to fill idle time.",
      labelAr: "لا تزال هناك سعة — فرصة لملء وقت الخمول.",
    });
  }

  if (input.raw.vacationMode || input.raw.pauseMode) {
    out.push({
      code: "paused",
      labelEn: "Pause/vacation mode is on — intake is limited.",
      labelAr: "وضع الإيقاف/الإجازة مفعّل — الاستقبال محدود.",
    });
  }

  if (out.length === 0) {
    out.push({
      code: "balanced_day",
      labelEn: "Schedule looks balanced for today.",
      labelAr: "الجدول يبدو متوازناً لليوم.",
    });
  }

  return out.slice(0, 4);
}

export function explanationFromComputation(
  c: Pick<
    ScheduleComputation,
    "explanations"
  >,
): PublicScheduleExplanation[] {
  return c.explanations;
}
