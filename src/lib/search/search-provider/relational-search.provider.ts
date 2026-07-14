import { fetchActiveProviders } from "@/lib/search/repository/provider-search.repository";
import type {
  ProviderSearchContext,
  ProviderSearchResult,
  SearchProvider,
} from "@/lib/search/search-provider/types";

/**
 * Relational (SQL/Supabase) provider search — current MVP implementation.
 */
export class RelationalSearchProvider implements SearchProvider {
  readonly kind = "relational" as const;

  async search(context: ProviderSearchContext): Promise<ProviderSearchResult> {
    const providers = await fetchActiveProviders({
      categorySlug: context.categorySlug,
      groupSlug: context.groupSlug,
      citySlug: context.citySlug,
      textTerms: context.textTerms,
      verifiedOnly: context.verifiedOnly,
      limit: context.limit ?? 50,
    });

    return {
      providers,
      metadata: {
        backend: "relational",
        problemId: context.problemId ?? null,
      },
    };
  }
}

export const relationalSearchProvider = new RelationalSearchProvider();
