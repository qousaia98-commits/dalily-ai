/**
 * Multimodal fusion: Voice > Text > Image.
 * On conflict → clarification, do not assume.
 */

import type { MultimodalFusionResult, VoiceInterpretation } from "./types";

function mapUrgency(
  u: string | null | undefined,
): MultimodalFusionResult["urgency"] {
  if (u === "emergency" || u === "critical") return "emergency";
  if (u === "high") return "high";
  if (u === "low") return "low";
  return "normal";
}

function urgencyRank(u: MultimodalFusionResult["urgency"]): number {
  if (u === "emergency") return 4;
  if (u === "high") return 3;
  if (u === "normal") return 2;
  return 1;
}

function normalizeCategory(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  if (s === "electrician") return "electrical";
  if (s === "plumber") return "plumbing";
  return s;
}

/**
 * Combine voice interpretation with optional typed text + vision category.
 * Priority for primary text: voice transcript → typed text → (image alone insufficient).
 */
export function fuseVoiceTextImage(input: {
  voiceNormalized: string | null;
  voiceInterpretation: VoiceInterpretation | null;
  typedText?: string | null;
  typedCategorySlug?: string | null;
  visionCategorySlug?: string | null;
  visionContradiction?: boolean;
  visionSummaryEn?: string | null;
  visionSummaryAr?: string | null;
}): MultimodalFusionResult {
  const voiceText = input.voiceNormalized?.trim() || null;
  const typed = input.typedText?.trim() || null;

  const sourcePriority: MultimodalFusionResult["sourcePriority"] = [];
  if (voiceText) sourcePriority.push("voice");
  if (typed) sourcePriority.push("text");
  if (input.visionCategorySlug) sourcePriority.push("image");

  const primaryText = voiceText || typed || "";

  const voiceCat = normalizeCategory(
    input.voiceInterpretation?.categorySlug ?? null,
  );
  const textCat = normalizeCategory(input.typedCategorySlug);
  const imageCat = normalizeCategory(input.visionCategorySlug);

  // Category by priority: voice → text → image
  let categorySlug = voiceCat ?? textCat ?? imageCat;
  let contradiction = Boolean(input.visionContradiction);

  const cats = [voiceCat, textCat, imageCat].filter(Boolean) as string[];
  const unique = new Set(cats);
  if (unique.size > 1) {
    contradiction = true;
    // Prefer voice when present
    categorySlug = voiceCat ?? textCat ?? imageCat;
  }

  let urgency = mapUrgency(input.voiceInterpretation?.urgency);
  if (typed && /emergency|طارئ|مستعجل|عاجل|Notfall/i.test(typed)) {
    if (urgencyRank("emergency") > urgencyRank(urgency)) {
      urgency = "emergency";
    }
  }

  const needsClarification =
    contradiction ||
    (!categorySlug && primaryText.length >= 8) ||
    (input.voiceInterpretation != null &&
      input.voiceInterpretation.confidence < 0.4);

  const confidenceParts: number[] = [];
  if (input.voiceInterpretation) {
    confidenceParts.push(input.voiceInterpretation.confidence);
  }
  if (voiceText && typed && voiceText !== typed) {
    // Slight drop when voice and typed diverge in wording but same intent OK
    confidenceParts.push(0.7);
  }
  const fusedConfidence = contradiction
    ? Math.min(...(confidenceParts.length ? confidenceParts : [0.35]), 0.4)
    : confidenceParts.length
      ? confidenceParts.reduce((a, b) => a + b, 0) / confidenceParts.length
      : 0.5;

  const summaryEn =
    input.voiceInterpretation?.summaryEn ||
    input.visionSummaryEn ||
    (primaryText
      ? `Customer said: ${primaryText.slice(0, 120)}`
      : "Voice request received.");
  const summaryAr =
    input.voiceInterpretation?.summaryAr ||
    input.visionSummaryAr ||
    summaryEn;

  return {
    primaryText,
    sourcePriority,
    categorySlug,
    urgency,
    contradiction,
    needsClarification,
    clarificationPromptKey: contradiction
      ? "voice.clarify.mismatch"
      : needsClarification
        ? "voice.clarify.low_confidence"
        : null,
    fusedConfidence,
    summaryEn,
    summaryAr,
  };
}
