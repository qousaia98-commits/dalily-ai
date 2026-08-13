/**
 * Scheduler facade — advisory appointment windows only.
 */

import {
  isAiPlatformEnabled,
  isAiSchedulingEnabled,
} from "@/lib/config/feature-flags";

export async function suggestScheduleHints(input: {
  categoryKey?: string;
  urgency?: "low" | "normal" | "high" | "emergency";
}): Promise<{
  windows: string[];
  conflictNote: string;
  advisoryOnly: true;
} | null> {
  if (!isAiPlatformEnabled() || !isAiSchedulingEnabled()) return null;

  const urgency = input.urgency ?? "normal";
  const windows =
    urgency === "emergency"
      ? ["ASAP / same-day window", "Next 2 hours if provider available"]
      : urgency === "high"
        ? ["Today afternoon", "Tomorrow morning"]
        : ["Within 48 hours", "Weekend morning", "Weekday evening"];

  return {
    windows,
    conflictNote:
      "Suggestions only — providers confirm availability. Use scheduling engine for live slots.",
    advisoryOnly: true,
  };
}
