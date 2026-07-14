import { cache } from "react";
import { getCategorySlugMap } from "@/lib/categories/queries";
import { CITY_IDS } from "@/lib/constants/reference-data";

export const getCategorySlugById = cache(async (): Promise<Map<string, string>> => {
  return getCategorySlugMap();
});

export async function categorySlugFromId(id: string): Promise<string | undefined> {
  const map = await getCategorySlugById();
  return map.get(id);
}

export function citySlugFromId(id: string): string | undefined {
  return Object.entries(CITY_IDS).find(([, value]) => value === id)?.[0];
}
