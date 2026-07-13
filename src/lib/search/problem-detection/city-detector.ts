import { CITY_IDS } from "@/lib/constants/reference-data";
import { normalizeSearchText } from "@/lib/search/engine/normalize";

const CITY_ALIASES: Record<string, string[]> = {
  damascus: ["damascus", "dimashq", "دمشق"],
  aleppo: ["aleppo", "halab", "حلب"],
  homs: ["homs", "حمص"],
  latakia: ["latakia", "lattakia", "اللاذقية"],
};

export function detectCitySlug(normalized: string): string | null {
  for (const [slug, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalizeSearchText(alias)))) {
      return slug in CITY_IDS ? slug : null;
    }
  }
  return null;
}

export function stripCityTokens(normalized: string, citySlug: string | null): string {
  if (!citySlug) return normalized;
  let text = normalized;
  for (const alias of CITY_ALIASES[citySlug] ?? []) {
    text = text.replace(new RegExp(normalizeSearchText(alias), "gi"), " ");
  }
  return text.replace(/\s+/g, " ").trim();
}
