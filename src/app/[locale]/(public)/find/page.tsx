import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  isDirectSearchV1Enabled,
  isCustomerIntentFlowV2Enabled,
} from "@/lib/config/feature-flags";
import { getActiveCities } from "@/lib/geo/cities";
import { getLeafCategories } from "@/lib/categories/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { findProvidersForDirectSearch } from "@/domains/customer/find-providers";
import { FindSearchForm } from "@/components/customer/find-search-form";
import { FindProviderResultCard } from "@/components/customer/find-provider-result-card";
import { Link } from "@/lib/i18n/navigation";

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
  searchParams: Promise<{ q?: string; category?: string; city?: string }>;
}) {
  if (!isDirectSearchV1Enabled()) {
    redirect("/");
  }

  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const sp = await searchParams;
  const t = await getTranslations("findFlow");

  const [cities, leaves] = await Promise.all([getActiveCities(), getLeafCategories()]);

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
  const city = sp.city?.trim() ?? "";
  const hasFilters = q.length >= 2 || Boolean(category) || Boolean(city);

  let providers: Awaited<ReturnType<typeof findProvidersForDirectSearch>> = [];
  let searchError: string | null = null;
  if (hasFilters) {
    try {
      providers = await findProvidersForDirectSearch({
        query: q.length >= 2 ? q : undefined,
        categorySlug: category || undefined,
        citySlug: city || undefined,
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
            <Link href="/request/new" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("broadcastCta")}
            </Link>
          </p>
        ) : null}
      </header>

      <FindSearchForm
        defaultQuery={q}
        defaultCategory={category}
        defaultCity={city}
        categories={categoryOptions}
        cities={cityOptions}
      />

      {searchError ? (
        <p className="text-sm text-destructive" role="alert">
          {searchError}
        </p>
      ) : null}

      {!hasFilters ? (
        <p className="text-center text-sm text-muted-foreground sm:text-start">{t("emptyPrompt")}</p>
      ) : providers.length === 0 && !searchError ? (
        <p className="text-center text-sm text-muted-foreground sm:text-start">{t("noResults")}</p>
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
