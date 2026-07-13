import { getLocale, getTranslations } from "next-intl/server";
import { searchProviders } from "@/lib/mock/data";
import { ProviderCard } from "@/components/providers/provider-card";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import type { Locale } from "@/lib/i18n/config";
import type { ServiceCategory } from "@/lib/constants/categories";
import { isServiceCategory } from "@/lib/constants/categories";
import type { SortOption } from "@/types/domain.types";
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
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("search");

  const query = searchParams.q?.trim() ?? "";
  const category = searchParams.category && isServiceCategory(searchParams.category)
    ? (searchParams.category as ServiceCategory)
    : undefined;

  const results = searchProviders(
    {
      query: query || undefined,
      category,
      city: searchParams.city,
      verifiedOnly: searchParams.verified === "true",
      sort: (searchParams.sort as SortOption) ?? "best_match",
    },
    locale,
  );

  const displayQuery =
    query ||
    (category ? (await getTranslations("home.categories"))(category) : "");

  if (results.length === 0) {
    return displayQuery ? (
      <SearchEmptyState query={displayQuery} />
    ) : (
      <p className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {t("prompt")}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("resultsCount", { count: results.length })}
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
