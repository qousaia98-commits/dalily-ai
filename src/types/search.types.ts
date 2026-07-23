import type { LocalizedText } from "@/types/domain.types";
import type { CategorySlug } from "@/lib/categories/types";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";

export type ProviderListItem = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: CategorySlug;
  categoryLabel: LocalizedText;
  city: LocalizedText;
  rating: number;
  reviewCount: number;
  trustScore: number;
  verified: boolean;
  planSlug?: import("@/lib/subscription/types").PlanSlug;
  coverImage: string;
  avatarImage: string;
  distanceKm?: number | null;
  profileCompleteness?: number;
  responseTimeHours?: number | null;
  /** Completed marketplace jobs (Smart Match) */
  completedJobs?: number;
  /** Why Dalily recommends this business */
  matchReasons?: import("@/lib/search/smart-match/reasons").MatchReason[];
  /**
   * Match confidence from Learning data quality.
   * null/undefined = hide indicator (insufficient data). Never invent.
   */
  matchConfidence?: import("@/lib/search/learning/types").MatchConfidence | null;
};

export type SearchProvidersInput = {
  query?: string;
  categorySlug?: CategorySlug;
  groupSlug?: CategorySlug;
  citySlug?: string;
  verifiedOnly?: boolean;
  locale?: string;
};

export type SearchProvidersResult = {
  providers: ProviderListItem[];
  parsed: {
    problemId: ProblemId | null;
    priority: ProblemPriority | null;
    categorySlug: CategorySlug | null;
    groupSlug: CategorySlug | null;
    citySlug: string | null;
    textTerms: string;
  };
};
