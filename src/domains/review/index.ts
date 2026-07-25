/**
 * SAD Review domain facade (Sprint 0).
 */

export const REVIEW_DOMAIN = {
  service: "review",
  owns: ["reviews", "review_responses"],
  impl: ["src/lib/reviews"],
  status: "facade",
} as const;

export {
  REVIEW_PAGE_SIZE,
  MAX_REVIEW_PHOTOS,
  type ReviewStatus,
  type ReviewSort,
  type PublicReview,
  type ProviderReviewStats,
} from "@/lib/reviews/types";
