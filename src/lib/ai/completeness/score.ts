import type {
  CompletenessBreakdown,
  CompletenessSignal,
} from "@/lib/ai/decision/types";

export type CompletenessInput = {
  hasDescription: boolean;
  hasCategory: boolean;
  hasScopeDetail: boolean;
  hasPhoto: boolean;
  hasLocation: boolean;
  hasMeasurements: boolean;
  hasUrgencyConfirmed: boolean;
  hasOngoingStatus: boolean;
};

const WEIGHTS: Record<CompletenessSignal, number> = {
  description: 0.25,
  category: 0.15,
  scope: 0.15,
  photo: 0.15,
  location: 0.15,
  measurements: 0.1,
  urgency: 0.03,
  ongoing_status: 0.02,
};

/**
 * Completeness 0–100. Missing signals drive the question engine.
 *
 * Rough product mapping:
 * - description only ≈ 40
 * - + photo ≈ 70
 * - + address ≈ 90
 * - + measurements ≈ 100
 */
export function calculateCompleteness(
  input: CompletenessInput,
): CompletenessBreakdown {
  const signals: CompletenessBreakdown["signals"] = {
    description: input.hasDescription,
    category: input.hasCategory,
    scope: input.hasScopeDetail,
    photo: input.hasPhoto,
    location: input.hasLocation,
    measurements: input.hasMeasurements,
    urgency: input.hasUrgencyConfirmed,
    ongoing_status: input.hasOngoingStatus,
  };

  let raw = 0;
  for (const [key, weight] of Object.entries(WEIGHTS) as Array<
    [CompletenessSignal, number]
  >) {
    if (signals[key]) raw += weight;
  }

  const missing = (
    Object.entries(signals) as Array<[CompletenessSignal, boolean | undefined]>
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  // Map weighted 0–1 onto product-ish percentages with a floor for description.
  let score = Math.round(raw * 100);
  if (input.hasDescription && !input.hasPhoto && !input.hasLocation) {
    score = Math.max(score, 40);
  }
  if (input.hasDescription && input.hasPhoto && !input.hasLocation) {
    score = Math.max(score, 70);
  }
  if (input.hasDescription && input.hasPhoto && input.hasLocation) {
    score = Math.max(score, 90);
  }
  if (
    input.hasDescription &&
    input.hasPhoto &&
    input.hasLocation &&
    input.hasMeasurements
  ) {
    score = 100;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    signals,
    missing,
  };
}

/** Heuristic: text already contains scope / ongoing / measurement cues. */
export function inferSignalsFromText(text: string): Partial<CompletenessInput> {
  const t = text;
  return {
    hasScopeDetail:
      /room|غرفة|apartment|شقة|kitchen|مطبخ|whole|كامل|toilet|مرحاض|pipe|أنبوب/i.test(
        t,
      ),
    hasOngoingStatus:
      /still (leaking|running)|عم يسرب|لساتو|now|الآن|stopped|وقف/i.test(t),
    hasMeasurements:
      /\d+\s*(m2|م٢|متر|cm|سم|meter)/i.test(t) ||
      /measurement|قياس|مساحة/i.test(t),
  };
}
