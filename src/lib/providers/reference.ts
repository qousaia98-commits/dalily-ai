import { CATEGORY_IDS, CITY_IDS } from "@/lib/constants/reference-data";

export function categorySlugFromId(id: string): string | undefined {
  return Object.entries(CATEGORY_IDS).find(([, value]) => value === id)?.[0];
}

export function citySlugFromId(id: string): string | undefined {
  return Object.entries(CITY_IDS).find(([, value]) => value === id)?.[0];
}
