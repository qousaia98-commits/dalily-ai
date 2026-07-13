import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/components/search/search-form";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";
import { SearchResultsSkeleton } from "@/components/shared/skeletons";
import { isServiceCategory } from "@/lib/constants/categories";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    verified?: string;
    sort?: string;
  }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("search");
  const tCategories = await getTranslations("home.categories");

  const query = params.q?.trim();
  const label =
    query || (params.category && isServiceCategory(params.category)
      ? tCategories(params.category)
      : "");

  return {
    title: label ? t("meta.titleWithQuery", { query: label }) : t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const t = await getTranslations("search");
  const tCategories = await getTranslations("home.categories");

  const defaultQuery =
    params.q?.trim() ||
    (params.category && isServiceCategory(params.category)
      ? tCategories(params.category)
      : "");

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </header>

        <div className="mb-8">
          <SearchForm defaultQuery={defaultQuery} size="compact" />
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="lg:w-64 lg:shrink-0">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
              <SearchFilters />
            </Suspense>
          </div>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<SearchResultsSkeleton />}>
              <SearchResults searchParams={params} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
