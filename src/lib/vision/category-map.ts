/**
 * Maps Vision service categories → Dalily ProblemId hints.
 * Detection still goes through HybridProblemDetector; this is for summary + skip logic only.
 */

import type { ProblemId } from "@/lib/search/engine/types";
import type { VisionServiceCategory } from "@/lib/vision/types";

const CATEGORY_TO_PROBLEM: Record<Exclude<VisionServiceCategory, "unsupported">, ProblemId> = {
  electrician: "power_outage",
  plumber: "water_leak",
  mechanic: "vehicle_repair",
  appliance_repair: "appliance_leak",
  locksmith: "locked_out",
};

export function problemIdForVisionCategory(
  category: VisionServiceCategory,
  problemHint?: string | null,
): ProblemId | null {
  if (category === "unsupported") return null;

  const hint = (problemHint ?? "").toLowerCase();
  if (category === "appliance_repair") {
    if (hint.includes("ac") || hint.includes("air condition") || hint.includes("hvac")) {
      return "ac_not_cooling";
    }
  }

  return CATEGORY_TO_PROBLEM[category];
}
