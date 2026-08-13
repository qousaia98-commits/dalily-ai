/**
 * AI review analysis + fake-review heuristics.
 * Never auto-publishes blocked/high-risk reviews.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { DimensionScores } from "@/lib/reviews/dimensions";

export type ReviewSentiment = "positive" | "neutral" | "negative" | "mixed";

export type FakeSignal =
  | "spam"
  | "repeated"
  | "copied"
  | "offensive"
  | "mass"
  | "bot"
  | "booking_conflict"
  | "fake_suspected"
  | "other";

export type AiAnalysisResult = {
  shortSummary: string;
  sentiment: ReviewSentiment;
  topics: string[];
  positiveHighlights: string[];
  improvementSuggestions: string[];
  languageDetected: string;
  translationReady: boolean;
  fakeRiskScore: number;
  fakeSignals: FakeSignal[];
  modelVersion: string;
};

const OFFENSIVE =
  /\b(idiot|stupid|scam|fraud|shit|fuck|kill|hate|garbage|نصب|احتيال|قذر)\b/i;
const SPAM =
  /(https?:\/\/|www\.|buy now|click here|whatsapp\s*\+|telegram\s*@)/i;
const POSITIVE_WORDS =
  /\b(great|excellent|amazing|professional|punctual|recommend|helpful|clean|رائع|ممتاز|محترف|أنصح)\b/i;
const NEGATIVE_WORDS =
  /\b(late|rude|poor|worst|unprofessional|expensive|dirty|متأخر|سيء|غالي)\b/i;
const TOPIC_MAP: Array<{ topic: string; re: RegExp }> = [
  { topic: "punctuality", re: /\b(on time|punctual|late|delay|في الموعد|متأخر)\b/i },
  { topic: "communication", re: /\b(communicat|response|reply|call|تواصل|رد)\b/i },
  { topic: "quality", re: /\b(quality|workmanship|result|جودة|شغل)\b/i },
  { topic: "value", re: /\b(price|value|expensive|cheap|سعر|قيمة)\b/i },
  { topic: "professionalism", re: /\b(professional|polite|respect|محترف|مهذب)\b/i },
];

export function analyzeReviewText(input: {
  rating: number;
  comment: string | null;
  recommend: boolean | null;
  dimensions?: DimensionScores;
  languageHint?: string;
}): AiAnalysisResult {
  const comment = (input.comment ?? "").trim();
  const languageDetected = detectLanguage(comment, input.languageHint);
  const topics = TOPIC_MAP.filter((t) => t.re.test(comment)).map((t) => t.topic);

  const hasPos = POSITIVE_WORDS.test(comment) || input.rating >= 4;
  const hasNeg = NEGATIVE_WORDS.test(comment) || input.rating <= 2;
  let sentiment: ReviewSentiment = "neutral";
  if (hasPos && hasNeg) sentiment = "mixed";
  else if (hasPos || input.rating >= 4) sentiment = "positive";
  else if (hasNeg || input.rating <= 2) sentiment = "negative";

  const positiveHighlights: string[] = [];
  const improvementSuggestions: string[] = [];
  for (const topic of topics) {
    if (sentiment === "positive" || sentiment === "mixed") {
      positiveHighlights.push(topic);
    }
    if (sentiment === "negative" || sentiment === "mixed") {
      improvementSuggestions.push(topic);
    }
  }
  if (input.dimensions) {
    for (const [dim, score] of Object.entries(input.dimensions)) {
      if (typeof score !== "number") continue;
      if (score >= 5) positiveHighlights.push(dim);
      if (score <= 2) improvementSuggestions.push(dim);
    }
  }

  const fakeSignals: FakeSignal[] = [];
  let fakeRisk = 0;
  if (SPAM.test(comment)) {
    fakeSignals.push("spam");
    fakeRisk += 0.35;
  }
  if (OFFENSIVE.test(comment)) {
    fakeSignals.push("offensive");
    fakeRisk += 0.25;
  }
  if (comment.length > 0 && comment.length < 8 && input.rating === 5) {
    fakeSignals.push("bot");
    fakeRisk += 0.15;
  }
  if (/^(.)\1{8,}$/.test(comment.replace(/\s/g, ""))) {
    fakeSignals.push("spam");
    fakeRisk += 0.4;
  }
  // Conflicting: 5★ overall but all dimensions ≤2 or recommend=no
  if (input.rating >= 5 && input.recommend === false) {
    fakeSignals.push("booking_conflict");
    fakeRisk += 0.2;
  }
  if (
    input.dimensions &&
    input.rating >= 5 &&
    Object.values(input.dimensions).some((s) => typeof s === "number" && s <= 2)
  ) {
    fakeSignals.push("fake_suspected");
    fakeRisk += 0.25;
  }

  const shortSummary = buildSummary({
    rating: input.rating,
    sentiment,
    topics,
    recommend: input.recommend,
    language: languageDetected,
  });

  return {
    shortSummary,
    sentiment,
    topics: [...new Set(topics)],
    positiveHighlights: [...new Set(positiveHighlights)].slice(0, 5),
    improvementSuggestions: [...new Set(improvementSuggestions)].slice(0, 5),
    languageDetected,
    translationReady: languageDetected === "ar" || languageDetected === "en",
    fakeRiskScore: Math.min(1, Math.round(fakeRisk * 1000) / 1000),
    fakeSignals: [...new Set(fakeSignals)],
    modelVersion: "heuristic-v1",
  };
}

function detectLanguage(comment: string, hint?: string): string {
  if (hint === "ar" || hint === "en") return hint;
  if (/[\u0600-\u06FF]/.test(comment)) return "ar";
  if (comment.length === 0) return hint || "en";
  return "en";
}

function buildSummary(input: {
  rating: number;
  sentiment: ReviewSentiment;
  topics: string[];
  recommend: boolean | null;
  language: string;
}): string {
  const topicStr =
    input.topics.length > 0 ? input.topics.slice(0, 3).join(", ") : "overall experience";
  if (input.language === "ar") {
    if (input.sentiment === "positive") {
      return `تقييم إيجابي (${input.rating}/5) يبرز: ${topicStr}.`;
    }
    if (input.sentiment === "negative") {
      return `تقييم سلبي (${input.rating}/5) يشير إلى مشاكل في: ${topicStr}.`;
    }
    return `تقييم مختلط (${input.rating}/5) حول: ${topicStr}.`;
  }
  if (input.sentiment === "positive") {
    return `Positive ${input.rating}/5 review highlighting ${topicStr}.`;
  }
  if (input.sentiment === "negative") {
    return `Critical ${input.rating}/5 review citing issues with ${topicStr}.`;
  }
  return `Mixed ${input.rating}/5 review about ${topicStr}.`;
}

export async function persistAiAnalysis(
  reviewId: string,
  analysis: AiAnalysisResult,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("review_ai_analysis").upsert(
    {
      review_id: reviewId,
      short_summary: analysis.shortSummary,
      sentiment: analysis.sentiment,
      topics: analysis.topics,
      positive_highlights: analysis.positiveHighlights,
      improvement_suggestions: analysis.improvementSuggestions,
      language_detected: analysis.languageDetected,
      translation_ready: analysis.translationReady,
      fake_risk_score: analysis.fakeRiskScore,
      fake_signals: analysis.fakeSignals,
      model_version: analysis.modelVersion,
      analyzed_at: new Date().toISOString(),
      raw: analysis,
    },
    { onConflict: "review_id" },
  );

  await admin
    .from("service_reviews")
    .update({
      ai_summary: analysis.shortSummary,
      sentiment: analysis.sentiment,
      language: analysis.languageDetected,
    })
    .eq("id", reviewId);

  for (const signal of analysis.fakeSignals) {
    await admin.from("review_flags").insert({
      review_id: reviewId,
      flag_type: signal,
      severity:
        analysis.fakeRiskScore >= 0.72
          ? "high"
          : analysis.fakeRiskScore >= 0.4
            ? "medium"
            : "low",
      source: "ai",
      reason: analysis.shortSummary,
      metadata: { fakeRiskScore: analysis.fakeRiskScore },
    });
  }
}

/** Detect near-duplicate comments from same customer or across provider. */
export async function enrichWithDuplicateSignals(
  reviewId: string,
  providerId: string,
  customerId: string,
  comment: string | null,
  analysis: AiAnalysisResult,
): Promise<AiAnalysisResult> {
  if (!comment || comment.trim().length < 20) return analysis;
  const admin = createAdminClient();
  const normalized = comment.trim().toLowerCase().slice(0, 200);

  const { data: others } = await admin
    .from("service_reviews")
    .select("id, comment, customer_id, created_at")
    .eq("provider_id", providerId)
    .neq("id", reviewId)
    .is("deleted_at", null)
    .limit(40);

  let massCount = 0;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const row of others ?? []) {
    const other = (row.comment ?? "").trim().toLowerCase().slice(0, 200);
    if (!other) continue;
    if (other === normalized || (other.length > 30 && normalized.includes(other.slice(0, 40)))) {
      analysis.fakeSignals = [...new Set([...analysis.fakeSignals, "copied" as FakeSignal])];
      analysis.fakeRiskScore = Math.min(1, analysis.fakeRiskScore + 0.35);
    }
    if (row.customer_id === customerId) {
      analysis.fakeSignals = [...new Set([...analysis.fakeSignals, "repeated" as FakeSignal])];
      analysis.fakeRiskScore = Math.min(1, analysis.fakeRiskScore + 0.2);
    }
    if (new Date(row.created_at).getTime() > dayAgo) massCount += 1;
  }
  if (massCount >= 8) {
    analysis.fakeSignals = [...new Set([...analysis.fakeSignals, "mass" as FakeSignal])];
    analysis.fakeRiskScore = Math.min(1, analysis.fakeRiskScore + 0.3);
  }
  return analysis;
}

export function buildProviderAiSummary(reviews: Array<{
  ai_summary: string | null;
  sentiment: string | null;
  rating: number;
  recommend: boolean | null;
}>): { en: string; ar: string; qualityLabel: string } {
  if (reviews.length === 0) {
    return { en: "", ar: "", qualityLabel: "" };
  }
  const avg =
    reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length;
  const positives = reviews.filter(
    (r) => r.sentiment === "positive" || r.rating >= 4,
  ).length;
  const recYes = reviews.filter((r) => r.recommend === true).length;
  const recTotal = reviews.filter((r) => r.recommend != null).length;
  const recPct =
    recTotal > 0 ? Math.round((recYes / recTotal) * 100) : null;

  const qualityLabel =
    avg >= 4.7
      ? "Excellent"
      : avg >= 4.2
        ? "Very good"
        : avg >= 3.5
          ? "Good"
          : avg >= 2.5
            ? "Fair"
            : "Needs improvement";

  const en =
    positives / reviews.length >= 0.7
      ? `Customers consistently praise overall quality${recPct != null ? ` — recommended by ${recPct}%` : ""}.`
      : `Mixed feedback across ${reviews.length} verified reviews (avg ${avg.toFixed(1)}).`;

  const ar =
    positives / reviews.length >= 0.7
      ? `يثني العملاء باستمرار على جودة الخدمة${recPct != null ? ` — يوصي بها ${recPct}%` : ""}.`
      : `تقييمات متباينة عبر ${reviews.length} مراجعة موثقة (متوسط ${avg.toFixed(1)}).`;

  return { en, ar, qualityLabel };
}
