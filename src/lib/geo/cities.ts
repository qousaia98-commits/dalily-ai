import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LocalizedJson } from "@/types/database.types";

export type CityOption = {
  id: string;
  slug: string;
  name: LocalizedJson;
};

export const getActiveCities = cache(async (): Promise<CityOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as LocalizedJson,
  }));
});
