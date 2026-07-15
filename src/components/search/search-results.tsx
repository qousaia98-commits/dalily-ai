import { getLocale, getTranslations } from "next-intl/server";
import { runDalilySearch } from "@/lib/search/search-engine";
import { ProviderCard } from "@/components/providers/provider-card";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { SearchErrorState } from "@/components/search/search-error-state";
import { SearchInsight } from "@/components/search/search-insight";
import {
  getCategoryGroups,
  getLeafCategories,
  isValidGroupSlug,
  isValidLeafCategorySlug,
} from "@/lib/categories/queries";
import { localizedField } from "@/lib/categories/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type SearchResultsProps = {
  searchParams: {
    q?: string;
    category?: string;
    group?: string;
    city?: string;
    verified?: string;
    sort?: string;
  };
};

export async function SearchResults({ searchParams }: SearchResultsProps) {
  const t = await getTranslations("search");
  const locale = (await getLocale()) as Locale;

  const query = searchParams.q?.trim() ?? "";
  const category =
    searchParams.category && (await isValidLeafCategorySlug(searchParams.category))
      ? searchParams.category
      : undefined;
  const group =
    searchParams.group && (await isValidGroupSlug(searchParams.group))
      ? searchParams.group
      : undefined;
  const city = searchParams.city && searchParams.city !== "all" ? searchParams.city : undefined;
  const verifiedOnly = searchParams.verified === "true";

  const hasSearch = Boolean(query || category || group || city || verifiedOnly);

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
      groupSlug: group,
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

  let displayQuery = query;
  if (!displayQuery && category) {
    const leaves = await getLeafCategories();
    const match = leaves.find((leaf) => leaf.slug === category);
    displayQuery = match ? localizedField(match.name, locale) : category;
  }
  if (!displayQuery && group) {
    const groups = await getCategoryGroups();
    const match = groups.find((item) => item.slug === group);
    displayQuery = match ? localizedField(match.name, locale) : group;
  }

  if (results.length === 0) {
    const emptyLabel =
      displayQuery ||
      (verifiedOnly ? t("filters.verifiedOnly") : "") ||
      (city ? city : "") ||
      undefined;

    return (
      <>
        <SearchInsight query={query} problemId={parsed.problemId} citySlug={parsed.citySlug} />
        <SearchEmptyState query={emptyLabel} />
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
