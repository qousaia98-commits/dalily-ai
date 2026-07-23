export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";

export type ReviewSort =
  | "newest"
  | "highest"
  | "lowest"
  | "helpful"
  | "verified"
  | "photos";

export type ReviewImage = {
  id: string;
  url: string;
  path: string;
};

export type PublicReview = {
  id: string;
  providerId: string;
  rating: number;
  comment: string | null;
  recommend: boolean | null;
  createdAt: string;
  updatedAt: string;
  isAnonymous: boolean;
  isVerified: boolean;
  verifiedBooking: boolean;
  verifiedCustomer: boolean;
  verifiedInteraction: boolean;
  helpfulCount: number;
  providerReply: string | null;
  providerRepliedAt: string | null;
  customerDisplayName: string;
  images: ReviewImage[];
  viewerHasVotedHelpful: boolean;
};

export type ProviderReviewStats = {
  ratingAvg: number;
  reviewCount: number;
  trustScore: number;
  distribution: import("@/lib/reviews/trust-score").RatingDistribution;
  photoCount: number;
};

export const REVIEW_PAGE_SIZE = 8;
export const MAX_REVIEW_PHOTOS = 5;
