import { cache } from "react";
import { MODULE_SERVICES_ID } from "@/lib/constants/reference-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CategoryGroupWithLeaves, CategoryRecord } from "@/lib/categories/types";

const CATEGORY_SELECT =
  "id, module_id, parent_id, slug, name, description, icon, depth, sort_order, is_active";

function mapCategoryRow(row: Record<string, unknown>): CategoryRecord {
  return row as CategoryRecord;
}

export const getActiveServiceCategories = cache(async (): Promise<CategoryRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("module_id", MODULE_SERVICES_ID)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true });

  return (data ?? []).map(mapCategoryRow);
});

export const getCategoryGroups = cache(async (): Promise<CategoryRecord[]> => {
  const categories = await getActiveServiceCategories();
  return categories.filter((category) => category.depth === 0);
});

export const getLeafCategories = cache(async (): Promise<CategoryRecord[]> => {
  const categories = await getActiveServiceCategories();
  return categories.filter((category) => category.depth === 1);
});

export const getCategoryGroupsWithLeaves = cache(async (): Promise<CategoryGroupWithLeaves[]> => {
  const categories = await getActiveServiceCategories();
  const groups = categories.filter((category) => category.depth === 0);
  return groups.map((group) => ({
    group,
    leaves: categories.filter((category) => category.parent_id === group.id && category.depth === 1),
  }));
});

export const getCategorySlugMap = cache(async (): Promise<Map<string, string>> => {
  const leaves = await getLeafCategories();
  return new Map(leaves.map((category) => [category.id, category.slug]));
});

export const getCategoryNameMap = cache(async (): Promise<Map<string, CategoryRecord["name"]>> => {
  const leaves = await getLeafCategories();
  return new Map(leaves.map((category) => [category.slug, category.name]));
});

export const resolveCategorySlugToId = cache(async (slug: string): Promise<string | null> => {
  const leaves = await getLeafCategories();
  return leaves.find((category) => category.slug === slug)?.id ?? null;
});

export const resolveGroupSlugToLeafIds = cache(async (groupSlug: string): Promise<string[]> => {
  const categories = await getActiveServiceCategories();
  const group = categories.find((category) => category.depth === 0 && category.slug === groupSlug);
  if (!group) return [];
  return categories
    .filter((category) => category.parent_id === group.id && category.depth === 1)
    .map((category) => category.id);
});

export async function isValidLeafCategorySlug(slug: string): Promise<boolean> {
  return (await resolveCategorySlugToId(slug)) !== null;
}

export async function isValidGroupSlug(slug: string): Promise<boolean> {
  const groups = await getCategoryGroups();
  return groups.some((group) => group.slug === slug);
}

export async function getAllCategoriesForAdmin(): Promise<CategoryRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("module_id", MODULE_SERVICES_ID)
    .is("deleted_at", null)
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true });

  return (data ?? []).map(mapCategoryRow);
}
