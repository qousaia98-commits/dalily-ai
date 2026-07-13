import { runDalilySearch } from "@/lib/search/search-engine";
import type { SearchProvidersInput, SearchProvidersResult } from "@/types/search.types";

/** @deprecated Use runDalilySearch from search-engine.ts */
export async function searchProvidersFromDb(
  input: SearchProvidersInput,
): Promise<SearchProvidersResult> {
  const result = await runDalilySearch({
    query: input.query,
    categorySlug: input.categorySlug,
    citySlug: input.citySlug,
    verifiedOnly: input.verifiedOnly,
    locale: input.locale,
  });

  return {
    providers: result.providers,
    parsed: result.parsed,
  };
}
