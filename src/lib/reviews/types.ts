export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";

export type ReviewSort =
  | "newest"
  | "highest"
  | "lowest"
  | "helpful"
  | "verified"
  | "photos"
  | "recommended"
  | "language";

export type ReviewImage = {
  id: string;
  url: string;
  path: string;
  mediaKind?: string;
};

export type ReviewDimensionScores = {
  overall?: number;
  communication?: number;
  quality?: number;
  punctuality?: number;
  professionalism?: number;
  value?: number;
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
  language?: string | null;
  aiSummary?: string | null;
  sentiment?: string | null;
  dimensions?: ReviewDimensionScores;
};

export type ProviderReviewStats = {
  ratingAvg: number;
  reviewCount: number;
  trustScore: number;
  distribution: import("@/lib/reviews/trust-score").RatingDistribution;
  photoCount: number;
  recommendationRate: number | null;
  qualityLabel: string | null;
  aiSummary: string | null;
  responseRate: number | null;
};

export const REVIEW_PAGE_SIZE = 8;
export const MAX_REVIEW_PHOTOS = 5;
