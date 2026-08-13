/**
 * Pre-appointment briefing for both sides.
 */

import type { AppointmentBriefing } from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export function buildAppointmentBriefing(input: {
  problemSummary: string;
  locationText?: string | null;
  startsAt?: string | null;
  estimatedDurationLabel?: string | null;
  tools?: string[];
  materials?: string[];
  specialNotes?: string[];
  serviceRequestId?: string | null;
}): AppointmentBriefing {
  const preparation = [
    ...(input.tools?.slice(0, 5).map((t) => `Bring: ${t.replace(/_/g, " ")}`) ??
      []),
    "Confirm access to the work area.",
    "Have ID / payment preference ready if needed.",
  ];

  const materials = (input.materials ?? []).slice(0, 6).map((m) =>
    m.replace(/_/g, " "),
  );

  const specialNotes = [
    ...(input.specialNotes ?? []),
    input.locationText
      ? `Area note: ${input.locationText}`
      : "Exact address may unlock closer to the visit.",
  ];

  const when = input.startsAt
    ? new Date(input.startsAt).toLocaleString()
    : "scheduled time";

  const briefing: AppointmentBriefing = {
    version: 7,
    problemSummary: input.problemSummary.trim() || "Service appointment",
    addressHint: input.locationText ?? null,
    preparation,
    estimatedDuration: input.estimatedDurationLabel ?? null,
    suggestedMaterials: materials,
    specialNotes,
    startsAt: input.startsAt ?? null,
    reminderEn: `Reminder: your appointment is at ${when}. Review the problem summary and prep list before you go.`,
    reminderAr: `تذكير: موعدك في ${when}. راجع ملخص المشكلة وقائمة التحضير قبل الذهاب.`,
  };

  if (input.serviceRequestId) {
    void emitAiLearningEvent({
      eventType: "assistant_appointment_briefed",
      serviceRequestId: input.serviceRequestId,
      metadata: { startsAt: input.startsAt ?? null },
    });
  }

  return briefing;
}
