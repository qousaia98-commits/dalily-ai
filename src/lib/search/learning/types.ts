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
  | "diagnosis_abandoned"
  | "intent_suggested"
  | "intent_confirmed"
  | "intent_corrected"
  | "category_changed"
  | "knowledge_hit"
  | "knowledge_miss"
  | "llm_invoked"
  | "provider_accepted"
  | "provider_declined"
  | "job_completed"
  | "memory_recorded"
  | "urgency_corrected"
  | "workflow_recommended"
  | "workflow_overridden"
  | "match_ranked"
  | "match_accepted"
  | "match_rejected"
  | "question_answered"
  | "intent_cached"
  | "dispatch_planned"
  | "dispatch_exposed"
  | "capacity_skipped"
  | "route_boosted"
  | "response_predicted"
  | "eta_predicted"
  | "prediction_compared"
  | "reputation_updated"
  | "job_analyzed"
  | "job_prep_shown"
  | "job_duration_compared"
  | "job_materials_compared"
  | "job_complexity_compared"
  | "multi_service_detected";

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
