import { createClient } from "@/lib/supabase/server";
import {
  resolveCategorySlugToId,
  resolveGroupSlugToLeafIds,
} from "@/lib/categories/queries";
import { CITY_IDS } from "@/lib/constants/reference-data";
import { SearchDatabaseError } from "@/lib/search/errors";
import type { Database } from "@/types/database.types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

/** Identity approved by admin — denormalized on providers when verification is approved. */
const SEARCH_VISIBLE_VERIFICATION: Database["public"]["Enums"]["verification_status"][] = [
  "verified",
  "partially_verified",
];

export type ProviderSearchFilters = {
  categorySlug?: string;
  groupSlug?: string;
  categoryIds?: string[];
  citySlug?: string;
  textTerms?: string;
  verifiedOnly?: boolean;
  limit?: number;
};

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

export async function fetchActiveProviders(
  filters: ProviderSearchFilters,
): Promise<ProviderRow[]> {
  let categoryIds = filters.categoryIds;

  if (!categoryIds?.length && filters.categorySlug) {
    const categoryId = await resolveCategorySlugToId(filters.categorySlug);
    categoryIds = categoryId ? [categoryId] : [];
  }

  if (!categoryIds?.length && filters.groupSlug) {
    categoryIds = await resolveGroupSlugToLeafIds(filters.groupSlug);
  }

  if (categoryIds && categoryIds.length === 0) {
    return [];
  }

  const cityId = filters.citySlug ? CITY_IDS[filters.citySlug] : undefined;

  const supabase = await createClient();

  let query = supabase
    .from("providers")
    .select("*")
    .eq("status", "active")
    .in("verification_status", SEARCH_VISIBLE_VERIFICATION)
    .is("deleted_at", null);

  if (categoryIds?.length) query = query.in("category_id", categoryIds);
  if (cityId) query = query.eq("city_id", cityId);
  if (filters.verifiedOnly) query = query.eq("verification_status", "verified");

  const text = filters.textTerms?.trim();
  if (text && text.length >= 2) {
    const term = escapeIlike(text);
    query = query.or(
      `name->>ar.ilike.%${term}%,name->>en.ilike.%${term}%,about->>ar.ilike.%${term}%,about->>en.ilike.%${term}%`,
    );
  }

  const { data, error } = await query.limit(filters.limit ?? 50);

  if (error) {
    throw new SearchDatabaseError(error.message, error.code);
  }

  return data ?? [];
}

export async function fetchImagePaths(imageIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (imageIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("images")
    .select("id, path")
    .in("id", imageIds)
    .is("deleted_at", null);

  for (const image of data ?? []) {
    map.set(image.id, image.path);
  }

  return map;
}
