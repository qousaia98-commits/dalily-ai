import type { LocalizedText } from "@/types/domain.types";
import type { ServiceCategory } from "@/lib/constants/categories";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";

export type ProviderListItem = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: ServiceCategory;
  city: LocalizedText;
  rating: number;
  reviewCount: number;
  trustScore: number;
  verified: boolean;
  coverImage: string;
  avatarImage: string;
  distanceKm?: number | null;
};

export type SearchProvidersInput = {
  query?: string;
  categorySlug?: ServiceCategory;
  citySlug?: string;
  verifiedOnly?: boolean;
  locale?: string;
};

export type SearchProvidersResult = {
  providers: ProviderListItem[];
  parsed: {
    problemId: ProblemId | null;
    priority: ProblemPriority | null;
    categorySlug: ServiceCategory | null;
    citySlug: string | null;
    textTerms: string;
  };
};
