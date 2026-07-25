/**
 * Matching reason codes — explainability for providers/customers (PSD 2.8).
 * Intentionally excludes subscription / premium / paid placement codes.
 */

export const MATCH_REASON_CODES = [
  "category_fit",
  "city_fit",
  "active_accepting",
  "verified",
  "emergency_priority",
  "newcomer_exploration",
  "expanded_area",
  "high_rating",
] as const;

export type MatchReasonCode = (typeof MATCH_REASON_CODES)[number];

export type MatchReason = {
  code: MatchReasonCode;
  params?: Record<string, string | number>;
};
