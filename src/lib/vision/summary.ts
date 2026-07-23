/**
 * Builds the natural-language problem description that enters the existing
 * HybridProblemDetector → Diagnosis → Search pipeline (same as typed/voice text).
 */

import type { VisionAnalysisPayload, VisionPipelineDecision } from "@/lib/vision/types";
import { VISION_SKIP_DIAGNOSIS_CONFIDENCE } from "@/lib/vision/constants";
import { problemIdForVisionCategory } from "@/lib/vision/category-map";
import type { ProblemPriority } from "@/lib/search/engine/types";

const CATEGORY_PHRASES: Record<string, string> = {
  electrician: "electrical problem",
  plumber: "plumbing water leak",
  mechanic: "vehicle car repair",
  appliance_repair: "appliance repair",
  locksmith: "locksmith locked out broken lock",
};

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function buildVisionQueryText(analysis: VisionAnalysisPayload): string {
  if (analysis.category === "unsupported") return "";

  const parts: string[] = [];
  const categoryPhrase = CATEGORY_PHRASES[analysis.category];
  if (categoryPhrase) parts.push(categoryPhrase);

  if (analysis.problem) parts.push(analysis.problem);
  if (analysis.symptoms.length) parts.push(analysis.symptoms.slice(0, 4).join(", "));
  if (analysis.possibleCause) parts.push(`possible cause: ${analysis.possibleCause}`);
  if (analysis.summary && analysis.summary !== analysis.problem) {
    parts.push(analysis.summary);
  }

  const joined = parts.filter(Boolean).join(". ");
  return clip(joined || analysis.summary || analysis.problem, 200);
}

export function buildVisionPipelineDecision(
  analysis: VisionAnalysisPayload,
): VisionPipelineDecision | null {
  if (analysis.category === "unsupported") return null;

  const queryText = buildVisionQueryText(analysis);
  if (queryText.length < 2) return null;

  const suggestedProblemId = problemIdForVisionCategory(analysis.category, analysis.problem);
  const urgencyOverride: ProblemPriority = analysis.emergency
    ? "emergency"
    : (analysis.urgency as ProblemPriority);

  const skipDiagnosis =
    analysis.confidenceLevel === VISION_SKIP_DIAGNOSIS_CONFIDENCE &&
    Boolean(urgencyOverride) &&
    analysis.symptoms.length >= 1;

  return {
    queryText,
    urgencyOverride,
    skipDiagnosis,
    suggestedProblemId,
    analysis,
  };
}
