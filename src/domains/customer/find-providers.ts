/**
 * Direct-search provider listing — name / category / city.
 * Never returns phone, email, or exact coordinates.
 */

import { fetchActiveProviders, fetchImagePaths } from "@/lib/search/repository/provider-search.repository";
import { mapProviderRowsToListItems } from "@/lib/search/mapper/provider-list-mapper";
import { getCategoryNameMap, getLeafCategories } from "@/lib/categories/queries";
import { categorySlugFromId } from "@/lib/providers/reference";
import type { Locale } from "@/lib/i18n/config";
import type { LocalizedText } from "@/types/domain.types";

export type FindProviderCard = {
  id: string;
  name: LocalizedText;
  categoryLabel: LocalizedText;
  city: LocalizedText;
  rating: number;
  reviewCount: number;
  verified: boolean;
  coverImage: string;
  avatarImage: string;
  distanceKm: number | null;
};

export type FindProvidersInput = {
  query?: string;
  categorySlug?: string;
  /** Top-level group slug (homepage CategoryGrid) — expands to leaf category ids. */
  groupSlug?: string;
  citySlug?: string;
  locale?: Locale;
  limit?: number;
};

export async function findProvidersForDirectSearch(
  input: FindProvidersInput,
): Promise<FindProviderCard[]> {
  const q = input.query?.trim() ?? "";
  const hasQuery = q.length >= 2;
  const hasCategory = Boolean(input.categorySlug?.trim());
  const hasGroup = Boolean(input.groupSlug?.trim());
  const hasCity = Boolean(input.citySlug?.trim());

  if (!hasQuery && !hasCategory && !hasGroup && !hasCity) {
    return [];
  }

  const rows = await fetchActiveProviders({
    textTerms: hasQuery ? q : undefined,
    categorySlug: input.categorySlug?.trim() || undefined,
    groupSlug: !hasCategory ? input.groupSlug?.trim() || undefined : undefined,
    citySlug: input.citySlug?.trim() || undefined,
    limit: input.limit ?? 40,
  });

  if (rows.length === 0) return [];

  const imageIds = rows.flatMap((r) =>
    [r.avatar_image_id, r.cover_image_id].filter((id): id is string => Boolean(id)),
  );
  const [imagePathById, categoryNameBySlug, leaves] = await Promise.all([
    fetchImagePaths(imageIds),
    getCategoryNameMap(),
    getLeafCategories(),
  ]);

  const categorySlugById = new Map<string, string>();
  for (const leaf of leaves) {
    categorySlugById.set(leaf.id, leaf.slug);
  }
  // Ensure mapped rows whose category isn't in leaves still resolve
  for (const row of rows) {
    if (!categorySlugById.has(row.category_id)) {
      const slug = await categorySlugFromId(row.category_id);
      if (slug) categorySlugById.set(row.category_id, slug);
    }
  }

  const locale = input.locale === "ar" ? "ar" : "en";
  const items = mapProviderRowsToListItems(
    rows,
    imagePathById,
    categorySlugById,
    categoryNameBySlug,
    undefined,
    undefined,
    undefined,
    locale,
  );

  return items.map((p) => ({
    id: p.id,
    name: p.name,
    categoryLabel: p.categoryLabel,
    city: p.city,
    rating: p.rating,
    reviewCount: p.reviewCount,
    verified: p.verified,
    coverImage: p.coverImage,
    avatarImage: p.avatarImage,
    distanceKm: p.distanceKm ?? null,
  }));
}
