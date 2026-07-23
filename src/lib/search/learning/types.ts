/**
 * Sprint 29 — Learning AI types.
 * Learning adjusts Smart Match; it never replaces it.
 */

export type LearningEventType =
  | "provider_viewed"
  | "provider_clicked"
  | "request_started"
  | "request_sent"
  | "request_accepted"
  | "request_declined"
  | "provider_no_response"
  | "request_completed"
  | "customer_cancelled"
  | "provider_cancelled"
  | "review_submitted"
  | "repeat_booking"
  | "recommendation_shown"
  | "recommendation_chosen"
  | "diagnosis_completed"
  | "diagnosis_abandoned";

export type MatchConfidence = "high" | "medium" | "low";

export type ProviderPerformanceRow = {
  providerId: string;
  performanceScore: number;
  acceptanceRate: number | null;
  completionRate: number | null;
  avgRating: number | null;
  avgResponseHours: number | null;
  cancellationRate: number | null;
  repeatCustomerRate: number | null;
  successfulJobs: number;
  sampleSize: number;
  dataQuality: number;
  factors: Record<string, number>;
  computedAt: string;
};

export type CustomerPreferenceProfile = {
  customerId: string;
  preferNearby: number;
  preferPremium: number;
  preferHighRating: number;
  preferFastResponse: number;
  sampleSize: number;
};

/** Max absolute adjustment Learning may apply on top of Smart Match (0–1 scale). */
export const LEARNING_MAX_ADJUSTMENT = 0.12;

/** Max absolute personalization nudge from customer preferences. */
export const PREFERENCE_MAX_ADJUSTMENT = 0.04;

/** Minimum samples before confidence may be shown. */
export const CONFIDENCE_MIN_SAMPLES = {
  low: 3,
  medium: 8,
  high: 20,
} as const;
