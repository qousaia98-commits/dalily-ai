import { getLocale, getTranslations } from "next-intl/server";
import { runDalilySearch } from "@/lib/search/search-engine";
import { ProviderCard } from "@/components/providers/provider-card";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { SearchErrorState } from "@/components/search/search-error-state";
import { SearchInsight } from "@/components/search/search-insight";
import type { ServiceCategory } from "@/lib/constants/categories";
import { isServiceCategory } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

type SearchResultsProps = {
  searchParams: {
    q?: string;
    category?: string;
    city?: string;
    verified?: string;
    sort?: string;
  };
};

export async function SearchResults({ searchParams }: SearchResultsProps) {
  const t = await getTranslations("search");
  const locale = await getLocale();

  const query = searchParams.q?.trim() ?? "";
  const category =
    searchParams.category && isServiceCategory(searchParams.category)
      ? (searchParams.category as ServiceCategory)
      : undefined;
  const city = searchParams.city && searchParams.city !== "all" ? searchParams.city : undefined;

  const hasSearch = Boolean(query || category || city);

  if (!hasSearch) {
    return (
      <p className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {t("prompt")}
      </p>
    );
  }

  let results;
  let parsed;

  try {
    const searchResult = await runDalilySearch({
      query: query || undefined,
      categorySlug: category,
      citySlug: city,
      verifiedOnly: searchParams.verified === "true",
      locale,
    });
    results = searchResult.providers;
    parsed = searchResult.parsed;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[search]", error);
    }
    return <SearchErrorState />;
  }

  const displayQuery = query || (category ? (await getTranslations("home.categories"))(category) : "");

  if (results.length === 0) {
    return (
      <>
        <SearchInsight query={query} problemId={parsed.problemId} citySlug={parsed.citySlug} />
        <SearchEmptyState query={displayQuery || t("empty.queryLabel")} />
      </>
    );
  }

  return (
    <div>
      <SearchInsight query={query} problemId={parsed.problemId} citySlug={parsed.citySlug} />
      <p className="mb-6 text-sm text-muted-foreground">
        {t("topResults", { count: results.length })}
        {displayQuery ? ` — "${displayQuery}"` : ""}
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {results.map((provider, index) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            className={cn("animate-fade-in-up", `stagger-${Math.min(index + 1, 4)}`)}
          />
        ))}
      </div>
    </div>
  );
}
