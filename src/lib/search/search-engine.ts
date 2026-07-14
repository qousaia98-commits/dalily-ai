import { categoryForProblem } from "@/lib/search/engine/problem-catalog";
import type { SearchEngineInput, SearchEngineResult } from "@/lib/search/engine/types";
import { SEARCH_TOP_N as TOP_N } from "@/lib/search/engine/types";
import { getCategoryNameMap, getCategorySlugMap } from "@/lib/categories/queries";
import { mapProviderRowsToListItems } from "@/lib/search/mapper/provider-list-mapper";
import {
  type ProblemDetector,
  ruleBasedProblemDetector,
} from "@/lib/search/problem-detection";
import { rankProviders } from "@/lib/search/ranking/rank-providers";
import { fetchImagePaths } from "@/lib/search/repository/provider-search.repository";
import { insertSearchLog } from "@/lib/search/repository/search-log.repository";
import {
  type SearchProvider,
  relationalSearchProvider,
} from "@/lib/search/search-provider";
import { getAuthUser } from "@/lib/auth/session";
import { getActivePlanSlugsByProviderIds } from "@/lib/subscription/repository";

/**
 * Dalily Search Engine
 *
 * Pipeline:
 * User Query → Problem Detection → Category → Priority
 *           → Provider Search → Ranking (Dalily Score) → Results
 *
 * Swappable layers:
 * - ProblemDetector (rules today, LLM later)
 * - SearchProvider (relational today, hybrid/vector/AI later)
 */
export class DalilySearchEngine {
  constructor(
    private readonly problemDetector: ProblemDetector = ruleBasedProblemDetector,
    private readonly searchProvider: SearchProvider = relationalSearchProvider,
  ) {}

  async search(input: SearchEngineInput): Promise<SearchEngineResult> {
    const parsed = input.query ? this.problemDetector.detect(input.query) : null;

    const problemId = parsed?.problem?.problemId ?? null;
    const priority = parsed?.problem?.priority ?? null;
    const citySlug = input.citySlug ?? parsed?.citySlug ?? null;
    const categorySlug =
      input.categorySlug ?? (problemId && !input.groupSlug ? categoryForProblem(problemId) : undefined);
    const groupSlug = input.groupSlug;
    const textTerms = parsed?.textTerms ?? "";

    const { providers: rows } = await this.searchProvider.search({
      categorySlug: groupSlug ? undefined : categorySlug,
      groupSlug,
      citySlug: citySlug ?? undefined,
      textTerms: textTerms || undefined,
      problemId,
      priority,
      verifiedOnly: input.verifiedOnly,
      limit: 50,
    });

    const planSlugsByProviderId = await getActivePlanSlugsByProviderIds(rows.map((row) => row.id));
    const ranked = rankProviders(rows, { priority, planSlugsByProviderId }).slice(0, TOP_N);

    const imageIds = ranked
      .flatMap((row) => [row.avatar_image_id, row.cover_image_id])
      .filter((id): id is string => Boolean(id));

    const [imagePathById, categorySlugById, categoryNameBySlug] = await Promise.all([
      fetchImagePaths(imageIds),
      getCategorySlugMap(),
      getCategoryNameMap(),
    ]);
    const providers = mapProviderRowsToListItems(
      ranked,
      imagePathById,
      categorySlugById,
      categoryNameBySlug,
    );

    const result: SearchEngineResult = {
      providers,
      parsed: {
        problemId,
        priority,
        categorySlug: categorySlug ?? null,
        groupSlug: groupSlug ?? null,
        citySlug,
        textTerms,
      },
    };

    void this.logSearch(input, parsed?.normalized ?? null, result);

    return result;
  }

  private async logSearch(
    input: SearchEngineInput,
    normalizedQuery: string | null,
    result: SearchEngineResult,
  ): Promise<void> {
    if (!input.query?.trim()) return;

    try {
      const userId = input.userId ?? (await getAuthUser())?.id ?? null;

      await insertSearchLog({
        queryText: input.query.trim(),
        normalizedQuery,
        problemId: result.parsed.problemId,
        categorySlug: result.parsed.categorySlug,
        citySlug: result.parsed.citySlug,
        priority: result.parsed.priority,
        resultCount: result.providers.length,
        providerIds: result.providers.map((provider) => provider.id),
        userId,
        locale: input.locale ?? null,
      });
    } catch (error) {
      console.error("[search_logs] unexpected failure:", error);
    }
  }
}

export const dalilySearchEngine = new DalilySearchEngine();

export async function runDalilySearch(input: SearchEngineInput): Promise<SearchEngineResult> {
  return dalilySearchEngine.search(input);
}
