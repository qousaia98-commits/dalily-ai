import { createAdminClient } from "@/lib/supabase/admin";
import type { LocalizedJson } from "@/types/database.types";

export type AdminFilterOption = {
  id: string;
  slug: string;
  name: LocalizedJson;
};

export async function getAdminCities(): Promise<AdminFilterOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cities")
    .select("id, slug, name")
    .order("sort_order", { ascending: true });

  return (data ?? []) as AdminFilterOption[];
}

export async function getAdminCategories(): Promise<AdminFilterOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categories")
    .select("id, slug, name")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  return (data ?? []) as AdminFilterOption[];
}
