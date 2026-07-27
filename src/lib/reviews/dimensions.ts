/** Multi-dimensional rating categories for Sprint 7 Phase 2. */

export const REVIEW_DIMENSIONS = [
  "overall",
  "communication",
  "quality",
  "punctuality",
  "professionalism",
  "value",
] as const;

export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number];

export type DimensionScores = Partial<Record<ReviewDimension, number>>;

export const DIMENSION_LABEL_KEYS: Record<ReviewDimension, string> = {
  overall: "overall",
  communication: "communication",
  quality: "quality",
  punctuality: "punctuality",
  professionalism: "professionalism",
  value: "value",
};

export function parseDimensionScores(
  input: Record<string, unknown>,
): DimensionScores | null {
  const scores: DimensionScores = {};
  for (const dim of REVIEW_DIMENSIONS) {
    const raw = input[dim];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) return null;
    scores[dim] = n;
  }
  if (scores.overall == null) return null;
  return scores;
}

export function averageOfDimensions(scores: DimensionScores): number {
  const vals = REVIEW_DIMENSIONS.map((d) => scores[d]).filter(
    (v): v is number => typeof v === "number",
  );
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
