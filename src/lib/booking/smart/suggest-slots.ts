/**
 * AI slot ranking — prefer soonest viable, light workload, travel buffer, urgency.
 */

import { generateAvailableSlots } from "@/lib/booking/slot-service";
import { getAvailabilitySettings } from "@/lib/booking/availability-service";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type {
  AppointmentType,
  SlotSuggestInput,
  SmartSlotSuggestions,
  SuggestedSlot,
} from "./types";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function resolveAppointmentType(
  type: AppointmentType | undefined,
  urgency: "emergency" | "normal" | undefined,
): AppointmentType {
  if (urgency === "emergency") return "emergency";
  return type ?? "scheduled";
}

function filterByAppointmentType(
  slots: Awaited<ReturnType<typeof generateAvailableSlots>>,
  appointmentType: AppointmentType,
): typeof slots {
  const now = new Date();
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (appointmentType) {
    case "immediate":
      return slots.filter((s) => {
        const t = new Date(s.startsAt).getTime() - now.getTime();
        return t >= 0 && t <= 3 * 3600_000;
      });
    case "today":
    case "emergency":
      return slots.filter((s) => isSameLocalDay(new Date(s.startsAt), now));
    case "video":
    case "scheduled":
    case "recurring":
    default:
      return slots;
  }
}

/**
 * Rank slots: sooner + fewer same-day peers + midday preference for non-emergency.
 */
export async function suggestSmartSlots(
  input: SlotSuggestInput,
): Promise<SmartSlotSuggestions> {
  const settings = await getAvailabilitySettings(input.providerId);
  const travelBufferMinutes = Math.max(
    settings.bufferMinutes,
    settings.travelBufferMinutes || 20,
  );

  const appointmentType = resolveAppointmentType(
    input.appointmentType,
    input.urgency,
  );

  const days =
    appointmentType === "immediate" ||
    appointmentType === "today" ||
    appointmentType === "emergency"
      ? 2
      : (input.days ?? 14);

  const raw = await generateAvailableSlots({
    providerId: input.providerId,
    fromDate: input.fromDate,
    durationMinutes: input.durationMinutes,
    days,
  });

  const filtered = filterByAppointmentType(raw, appointmentType);
  const now = Date.now();

  const scored: SuggestedSlot[] = filtered.map((slot) => {
    const start = new Date(slot.startsAt);
    const hoursAhead = (start.getTime() - now) / 3600_000;
    const sameDayPeers = filtered.filter((s) =>
      isSameLocalDay(new Date(s.startsAt), start),
    ).length;

    let score = 100;
    // Prefer sooner for emergency / immediate / today
    if (
      appointmentType === "emergency" ||
      appointmentType === "immediate" ||
      appointmentType === "today"
    ) {
      score -= Math.min(40, hoursAhead * 4);
    } else {
      // Prefer tomorrow morning / afternoon clusters over far future
      score -= Math.min(30, Math.max(0, hoursAhead - 12) * 0.8);
    }

    // Prefer lighter day occupancy
    score -= Math.min(20, (sameDayPeers - 1) * 2);

    // Prefer mid-day (10–16) for scheduled; evenings for emergency ok
    const hour = start.getHours();
    if (appointmentType === "scheduled" || appointmentType === "recurring") {
      if (hour >= 10 && hour <= 16) score += 8;
      if (hour < 9 || hour > 18) score -= 6;
    }

    // Lunch fragmentation avoidance: 12–13 slightly down unless only option
    if (hour === 12) score -= 3;

    const reasonsEn: string[] = [];
    const reasonsAr: string[] = [];
    if (hoursAhead < 6) {
      reasonsEn.push("Soonest available");
      reasonsAr.push("أقرب وقت متاح");
    }
    if (sameDayPeers <= 2) {
      reasonsEn.push("Light schedule that day");
      reasonsAr.push("جدول خفيف في ذلك اليوم");
    }
    if (travelBufferMinutes > 0) {
      reasonsEn.push(`${travelBufferMinutes} min travel buffer`);
      reasonsAr.push(`هامش تنقل ${travelBufferMinutes} د`);
    }

    return {
      ...slot,
      rank: 0,
      score,
      label: "alternative" as const,
      reasonsEn,
      reasonsAr,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.startsAt.localeCompare(b.startsAt));
  scored.forEach((s, i) => {
    s.rank = i + 1;
    s.label = i === 0 ? "recommended" : "alternative";
  });

  const top = scored.slice(0, 4);
  const recommended = top[0] ?? null;
  const alternatives = top.slice(1);

  void emitAiLearningEvent({
    eventType: "slot_suggested",
    providerId: input.providerId,
    metadata: {
      appointmentType,
      count: top.length,
      recommendedStartsAt: recommended?.startsAt ?? null,
      travelBufferMinutes,
    },
  });

  return {
    version: 2,
    appointmentType,
    travelBufferMinutes,
    recommended,
    alternatives,
    allSlots: filtered,
  };
}
