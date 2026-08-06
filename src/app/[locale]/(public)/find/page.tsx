import type { Metadata } from "next";
import { X } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { isCustomerIntentFlowV2Enabled } from "@/lib/config/feature-flags";
import { getActiveCities } from "@/lib/geo/cities";
import { nearestCitySlugFromCoords } from "@/lib/geo/nearest-city";
import { getLeafCategories, getCategoryGroups } from "@/lib/categories/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { findProvidersForDirectSearch } from "@/domains/customer/find-providers";
import { FindSearchForm } from "@/components/customer/find-search-form";
import { FindProviderResultCard } from "@/components/customer/find-provider-result-card";
import { Link } from "@/lib/i18n/navigation";
import {
  NEARBY_LOC_COOKIE,
  parseNearbyLocCookie,
} from "@/lib/business/message-read-state";
import { LOC_PREF_COOKIE } from "@/lib/geo/location-preference";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findFlow");
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function FindBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    group?: string;
    city?: string;
  }>;
}) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const sp = await searchParams;
  const t = await getTranslations("findFlow");

  const [cities, leaves, groups, jar] = await Promise.all([
    getActiveCities(),
    getLeafCategories(),
    getCategoryGroups(),
    cookies(),
  ]);

  const cityOptions = cities.map((c) => ({
    slug: c.slug,
    label: getLocalizedText(c.name, locale) || c.slug,
  }));
  const categoryOptions = leaves.map((c) => ({
    slug: c.slug,
    label: getLocalizedText(c.name, locale) || c.slug,
  }));

  const q = sp.q?.trim() ?? "";
  const category = sp.category?.trim() ?? "";
  const group = sp.group?.trim() ?? "";
  const cityExplicit = sp.city?.trim() ?? "";

  // Visible confirmation of what was clicked — the leaf-category dropdown
  // can't show a top-level group as a single selected option, so surface
  // it separately instead of leaving the form looking like "Any category".
  const activeCategoryLabel = category
    ? categoryOptions.find((c) => c.slug === category)?.label
    : group
      ? (() => {
          const match = groups.find((g) => g.slug === group);
          return match ? getLocalizedText(match.name, locale) || match.slug : null;
        })()
      : null;

  let defaultCity = cityExplicit;
  if (!defaultCity && jar.get(LOC_PREF_COOKIE)?.value === "enabled") {
    const nearby = parseNearbyLocCookie(jar.get(NEARBY_LOC_COOKIE)?.value);
    if (nearby) {
      const nearest = nearestCitySlugFromCoords(nearby.lat, nearby.lng);
      if (nearest && cityOptions.some((c) => c.slug === nearest)) {
        defaultCity = nearest;
      }
    }
  }

  const hasFilters =
    q.length >= 2 || Boolean(category) || Boolean(group) || Boolean(defaultCity);

  let providers: Awaited<ReturnType<typeof findProvidersForDirectSearch>> = [];
  let searchError: string | null = null;
  if (hasFilters) {
    try {
      providers = await findProvidersForDirectSearch({
        query: q.length >= 2 ? q : undefined,
        categorySlug: category || undefined,
        groupSlug: !category && group ? group : undefined,
        citySlug: defaultCity || undefined,
        locale,
      });
    } catch {
      searchError = t("errors.searchFailed");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2 text-center sm:text-start">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        {isCustomerIntentFlowV2Enabled() ? (
          <p className="text-sm text-muted-foreground">
            {t("broadcastHint")}{" "}
            <Link
              href="/request/new?mode=publish"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("broadcastCta")}
            </Link>
          </p>
        ) : null}
      </header>

      {activeCategoryLabel ? (
        <div className="flex justify-center sm:justify-start">
          <Link
            href="/find"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)] px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-[var(--dalily-gold)]/70"
          >
            {t("filteringBy", { category: activeCategoryLabel })}
            <X className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <FindSearchForm
        defaultQuery={q}
        defaultCategory={category}
        defaultGroup={group}
        defaultCity={defaultCity}
        categories={categoryOptions}
        cities={cityOptions}
      />

      {searchError ? (
        <p className="text-sm text-destructive" role="alert">
          {searchError}
        </p>
      ) : null}

      {!hasFilters ? (
        <p className="text-center text-sm text-muted-foreground sm:text-start">
          {t("emptyPrompt")}
        </p>
      ) : providers.length === 0 && !searchError ? (
        <p className="text-center text-sm text-muted-foreground sm:text-start">
          {t("noResults")}
        </p>
      ) : providers.length > 0 ? (
        <section className="space-y-4" aria-label={t("resultsLabel")}>
          <p className="text-sm text-muted-foreground">
            {t("resultsCount", { count: providers.length })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <FindProviderResultCard key={p.id} provider={p} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
