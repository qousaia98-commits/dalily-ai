import type { MatchConfidence } from "./types";
import { CONFIDENCE_MIN_SAMPLES } from "./types";

/**
 * Confidence from platform data quality — never invented.
 * Returns null when insufficient data (UI must hide indicator).
 */
export function resolveMatchConfidence(input: {
  sampleSize: number;
  dataQuality: number;
}): MatchConfidence | null {
  const { sampleSize, dataQuality } = input;
  if (sampleSize < CONFIDENCE_MIN_SAMPLES.low || dataQuality < 0.2) {
    return null;
  }
  if (sampleSize >= CONFIDENCE_MIN_SAMPLES.high && dataQuality >= 0.7) {
    return "high";
  }
  if (sampleSize >= CONFIDENCE_MIN_SAMPLES.medium && dataQuality >= 0.4) {
    return "medium";
  }
  if (sampleSize >= CONFIDENCE_MIN_SAMPLES.low && dataQuality >= 0.2) {
    return "low";
  }
  return null;
}
