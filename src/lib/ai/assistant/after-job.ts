/**
 * After-job assistant — summary, review ask, follow-ups, maintenance.
 */

import type { AfterJobAssist } from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export function buildAfterJobAssist(input: {
  problemSummary: string;
  categorySlug?: string | null;
  followUpFromJob?: string[];
  serviceRequestId?: string | null;
}): AfterJobAssist {
  const category = input.categorySlug ?? "service";
  const followUp =
    input.followUpFromJob?.length
      ? input.followUpFromJob
      : defaultFollowUps(category);

  const maintenance = defaultMaintenance(category);

  const assist: AfterJobAssist = {
    version: 7,
    jobSummaryEn: `Job completed for: ${input.problemSummary.slice(0, 160)}.`,
    jobSummaryAr: `اكتملت الخدمة بخصوص: ${input.problemSummary.slice(0, 160)}.`,
    askReview: true,
    followUpWork: followUp,
    maintenanceTips: maintenance,
  };

  if (input.serviceRequestId) {
    void emitAiLearningEvent({
      eventType: "assistant_after_job",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        followUpCount: followUp.length,
        categorySlug: category,
      },
    });
  }

  return assist;
}

function defaultFollowUps(category: string): string[] {
  if (category.includes("plumb")) {
    return ["Check for slow drips after 24h", "Consider pipe insulation if outdoor"];
  }
  if (category.includes("electric")) {
    return ["Test the circuit under load", "Schedule panel check if breakers trip again"];
  }
  if (category.includes("paint")) {
    return ["Touch-up after paint fully cures", "Ventilate room for 24–48h"];
  }
  return ["Confirm everything still works tomorrow"];
}

function defaultMaintenance(category: string): string[] {
  if (category.includes("plumb")) {
    return ["Avoid harsh drain chemicals weekly", "Report new leaks early"];
  }
  if (category.includes("hvac") || category.includes("ac")) {
    return ["Clean/replace filters every 1–3 months"];
  }
  return ["Book a checkup if symptoms return within a week"];
}
