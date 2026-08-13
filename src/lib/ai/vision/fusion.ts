/**
 * Fuse customer text understanding with structured vision analysis.
 * On contradiction → ask clarification; do not assume.
 */

import type {
  IntentVisionAnalysis,
  VisionTextFusionResult,
} from "./types";
import {
  suggestMaterialsFromVision,
  suggestToolsFromVision,
} from "./suggestions";

const TRADE_ALIASES: Record<string, string[]> = {
  electrical: ["electrician", "electrical", "electric", "wiring", "outlet", "switch"],
  plumbing: ["plumber", "plumbing", "pipe", "faucet", "leak", "drain", "sink"],
  painting: ["painter", "painting", "paint", "wall", "mold", "crack"],
  locksmith: ["locksmith", "lock", "key", "door"],
  hvac: ["hvac", "ac", "air_conditioner", "heater"],
};

function textMentionsTrade(text: string, trade: string): boolean {
  const lower = text.toLowerCase();
  const aliases = TRADE_ALIASES[trade] ?? [trade];
  return aliases.some((a) => lower.includes(a.replace(/_/g, " ")) || lower.includes(a));
}

function dominantTradeFromVision(analysis: IntentVisionAnalysis): string | null {
  const votes: Record<string, number> = {};
  for (const o of analysis.objects) {
    const trade = o.tradeHint;
    if (!trade) continue;
    const weight = o.importance === "primary" ? 2 : 1;
    votes[trade] = (votes[trade] ?? 0) + weight * o.confidence;
  }
  const hint = analysis.categoryHint;
  if (hint && hint !== "unsupported") {
    const mapped =
      hint === "electrician"
        ? "electrical"
        : hint === "plumber"
          ? "plumbing"
          : hint;
    votes[mapped] = (votes[mapped] ?? 0) + analysis.overallConfidence;
  }
  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

function mapHintToSlug(hint: string): string | null {
  if (!hint || hint === "unsupported") return null;
  if (hint === "electrician") return "electrical";
  if (hint === "plumber") return "plumbing";
  if (hint === "appliance_repair") return "appliance_repair";
  return hint;
}

function buildCustomerSummary(analysis: IntentVisionAnalysis): {
  en: string;
  ar: string;
} {
  const topDamage = analysis.damages[0];
  const topObject = analysis.objects[0];
  if (topDamage) {
    const label = topDamage.type.replace(/_/g, " ");
    return {
      en: `We detected possible ${label}.`,
      ar: `رصدنا احتمال ${label}.`,
    };
  }
  if (topObject) {
    const label = topObject.name.replace(/_/g, " ");
    return {
      en: `We detected a ${label}.`,
      ar: `رصدنا ${label}.`,
    };
  }
  if (analysis.summaryEn) {
    return { en: analysis.summaryEn, ar: analysis.summaryAr || analysis.summaryEn };
  }
  return {
    en: "We reviewed your photo.",
    ar: "راجعنا صورتك.",
  };
}

/**
 * Combine intent text with vision. Prefer clarification on conflict.
 */
export function fuseTextAndVision(input: {
  intentText: string;
  analysis: IntentVisionAnalysis;
  textCategorySlug?: string | null;
}): VisionTextFusionResult {
  const { analysis, intentText } = input;
  const visionTrade = dominantTradeFromVision(analysis);
  const textSlug = input.textCategorySlug?.toLowerCase() ?? null;

  let contradiction = false;
  if (visionTrade && textSlug) {
    const textTrade =
      textSlug === "electrician"
        ? "electrical"
        : textSlug === "plumber"
          ? "plumbing"
          : textSlug;
    if (textTrade !== visionTrade && !textMentionsTrade(intentText, visionTrade)) {
      contradiction = true;
    }
  }

  // Text says faucet leak, image shows strong electrical signal → contradiction
  if (visionTrade === "electrical" && textMentionsTrade(intentText, "plumbing")) {
    const electricalScore = analysis.objects
      .filter((o) => o.tradeHint === "electrical")
      .reduce((s, o) => s + o.confidence, 0);
    const plumbingScore = analysis.objects
      .filter((o) => o.tradeHint === "plumbing")
      .reduce((s, o) => s + o.confidence, 0);
    if (electricalScore > plumbingScore + 0.3) contradiction = true;
  }
  if (visionTrade === "plumbing" && textMentionsTrade(intentText, "electrical")) {
    const electricalScore = analysis.objects
      .filter((o) => o.tradeHint === "electrical")
      .reduce((s, o) => s + o.confidence, 0);
    const plumbingScore = analysis.objects
      .filter((o) => o.tradeHint === "plumbing")
      .reduce((s, o) => s + o.confidence, 0);
    if (plumbingScore > electricalScore + 0.3) contradiction = true;
  }

  const needsClarification = contradiction || analysis.overallConfidence < 0.45;
  const summaries = buildCustomerSummary(analysis);

  const jobCategorySlug = contradiction
    ? textSlug ?? mapHintToSlug(analysis.categoryHint)
    : mapHintToSlug(analysis.categoryHint) ?? textSlug;

  const urgencyBoost =
    !contradiction &&
    (analysis.emergency ||
      analysis.urgency === "emergency" ||
      analysis.urgency === "high" ||
      analysis.estimatedRisk === "high");

  const fusedConfidence = contradiction
    ? Math.min(analysis.overallConfidence, 0.4)
    : analysis.overallConfidence;

  return {
    analysis,
    jobCategorySlug,
    urgencyBoost,
    contradiction,
    needsClarification,
    clarificationPromptKey: contradiction
      ? "vision.clarify.mismatch"
      : needsClarification
        ? "vision.clarify.low_confidence"
        : null,
    fusedConfidence,
    customerSummaryEn: summaries.en,
    customerSummaryAr: summaries.ar,
    suggestedTools: suggestToolsFromVision(analysis.objects, analysis.damages),
    suggestedMaterials: suggestMaterialsFromVision(analysis.damages),
  };
}
