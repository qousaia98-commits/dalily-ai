/**
 * Future ML readiness — extension points only.
 * No live models yet; structure for years of AI growth.
 */

export type FutureMlFeatureVector = {
  providerId: string;
  smartMatchScore: number;
  performanceScore: number;
  dataQuality: number;
  /** Sparse learning event counts by type (windowed) */
  eventCounts: Record<string, number>;
  customerPreferenceHash?: string | null;
};

export type FutureMlModelSlot =
  | "recommendation_model"
  | "price_intelligence"
  | "fraud_detection"
  | "churn_prediction"
  | "business_quality_prediction"
  | "demand_forecasting";

export type FutureMlPrediction = {
  model: FutureMlModelSlot;
  score: number | null;
  version: string | null;
};

/** Build a training-ready feature row from current learning state. */
export function buildFeatureVector(
  input: Omit<FutureMlFeatureVector, "eventCounts"> & {
    eventCounts?: Record<string, number>;
  },
): FutureMlFeatureVector {
  return {
    ...input,
    eventCounts: input.eventCounts ?? {},
  };
}

/** Placeholder — returns null until a model is registered. */
export function predictWithFutureModel(
  _slot: FutureMlModelSlot,
  _features: FutureMlFeatureVector,
): FutureMlPrediction {
  return { model: _slot, score: null, version: null };
}
