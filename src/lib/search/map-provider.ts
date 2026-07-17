import type { MockProvider } from "@/types/domain.types";
import type { ProviderListItem } from "@/types/search.types";

export function mockProviderToListItem(provider: MockProvider): ProviderListItem {
  return {
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    category: provider.category,
    categoryLabel: { ar: provider.category, en: provider.category },
    city: provider.city,
    rating: provider.rating,
    reviewCount: provider.reviewCount,
    trustScore: provider.trustScore,
    verified: provider.verified,
    coverImage: provider.coverImage,
    avatarImage: provider.avatarImage,
    distanceKm: provider.distanceKm,
    planSlug: "free",
  };
}
