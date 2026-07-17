import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SearchForm } from "@/components/search/search-form";
import { SearchFiltersPanel } from "@/components/search/search-filters-panel";
import { SearchResults } from "@/components/search/search-results";
import { SearchResultsSkeleton } from "@/components/shared/skeletons";
import {
  getCategoryGroups,
  getLeafCategories,
  isValidGroupSlug,
  isValidLeafCategorySlug,
} from "@/lib/categories/queries";
import { localizedField } from "@/lib/categories/format";
import type { Locale } from "@/lib/i18n/config";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    group?: string;
    city?: string;
    verified?: string;
    sort?: string;
    nearby?: string;
  }>;
};

async function resolveSearchLabel(params: {
  q?: string;
  category?: string;
  group?: string;
}): Promise<string> {
  const locale = (await getLocale()) as Locale;
  const query = params.q?.trim();
  if (query) return query;

  if (params.category && (await isValidLeafCategorySlug(params.category))) {
    const leaves = await getLeafCategories();
    const match = leaves.find((leaf) => leaf.slug === params.category);
    return match ? localizedField(match.name, locale) : params.category;
  }

  if (params.group && (await isValidGroupSlug(params.group))) {
    const groups = await getCategoryGroups();
    const match = groups.find((group) => group.slug === params.group);
    return match ? localizedField(match.name, locale) : params.group;
  }

  return "";
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("search");
  const label = await resolveSearchLabel(params);

  return {
    title: label ? t("meta.titleWithQuery", { query: label }) : t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const t = await getTranslations("search");
  const defaultQuery = await resolveSearchLabel(params);

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
              <SearchFiltersPanel />
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
