/**
 * Sprint 40 — Configurable Dalily Score weights (sum ≈ 1).
 * Server-side only; providers cannot mutate.
 */

export const DALILY_SCORE_COMPONENT_KEYS = [
  "quality",
  "trust",
  "reliability",
  "activity",
  "availability",
  "distance",
  "experience",
  "profileQuality",
  "popularity",
  "response",
] as const;

export type DalilyScoreComponentKey = (typeof DALILY_SCORE_COMPONENT_KEYS)[number];

export type DalilyWeightMap = Record<DalilyScoreComponentKey, number>;

export const DEFAULT_DALILY_WEIGHTS: DalilyWeightMap = {
  quality: 0.14,
  trust: 0.14,
  reliability: 0.12,
  activity: 0.08,
  availability: 0.08,
  distance: 0.14,
  experience: 0.08,
  profileQuality: 0.08,
  popularity: 0.07,
  response: 0.07,
};

/** How strongly Dalily Score overrides Smart Match on `relevant` sort. */
export const DALILY_SMART_MATCH_BLEND = {
  /** Existing Smart Match / Learning score (0–1) */
  smartMatch: 0.4,
  /** New modular Dalily Score (0–1) */
  dalily: 0.6,
} as const;

export function normalizeWeights(weights: Partial<DalilyWeightMap>): DalilyWeightMap {
  const merged: DalilyWeightMap = { ...DEFAULT_DALILY_WEIGHTS, ...weights };
  const sum = DALILY_SCORE_COMPONENT_KEYS.reduce((acc, k) => acc + merged[k], 0);
  if (sum <= 0) return { ...DEFAULT_DALILY_WEIGHTS };
  const out = { ...merged };
  for (const k of DALILY_SCORE_COMPONENT_KEYS) {
    out[k] = merged[k] / sum;
  }
  return out;
}

export function getActiveWeights(
  overrides?: Partial<DalilyWeightMap> | null,
): DalilyWeightMap {
  return overrides ? normalizeWeights(overrides) : DEFAULT_DALILY_WEIGHTS;
}
