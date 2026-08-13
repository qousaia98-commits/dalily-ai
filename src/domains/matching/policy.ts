/**
 * Matching policy constants (product philosophy, not ML weights).
 * Subscription tiers are never consulted.
 */

export const MATCHING_POLICY = {
  /** Initial shortlist size (competition without chaos). */
  initialMaxAssignments: 8,
  /** After expand-on-failure. */
  expandedMaxAssignments: 15,
  /** Trigger expand when fewer than this after initial pass. */
  minDesiredAssignments: 3,
  /** Soft exploration share for low-review providers in the fit pool. */
  newcomerMax: 2,
  /** Review count below this counts as newcomer. */
  newcomerReviewThreshold: 3,
} as const;

export type MatchingPolicySnapshot = {
  initialMaxAssignments: number;
  expandedMaxAssignments: number;
  minDesiredAssignments: number;
  newcomerMax: number;
  subscriptionInfluence: false;
};
