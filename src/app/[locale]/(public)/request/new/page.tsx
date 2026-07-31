import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  isCustomerIntentFlowV2Enabled,
  isDirectSearchV1Enabled,
  isAiEngineV5Enabled,
  isAiEngineV6Enabled,
} from "@/lib/config/feature-flags";
import { getAuthUser } from "@/lib/auth/session";
import { getActiveCities } from "@/lib/geo/cities";
import { getLocalizedText } from "@/types/domain.types";
import { IntentIntakeFlow } from "@/components/customer/intent-intake-flow";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { categorySlugFromId } from "@/lib/providers/reference";
import { getCategoryNameMap } from "@/lib/categories/queries";
import type { TargetProviderContext } from "@/components/customer/intent-intake-flow/types";

export default async function NewIntentRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; providerId?: string }>;
}) {
  if (!isCustomerIntentFlowV2Enabled()) {
    redirect("/");
  }

  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const sp = await searchParams;
  const t = await getTranslations("intentFlow");
  const authUser = await getAuthUser();
  const cities = await getActiveCities();

  const cityOptions = cities.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: getLocalizedText(c.name, locale) || c.slug,
  }));

  let targetProvider: TargetProviderContext | null = null;
  const providerId = sp.providerId?.trim() || "";
  if (providerId && isDirectSearchV1Enabled()) {
    const supabase = await createClient();
    const { data: provider } = await supabase
      .from("providers")
      .select("id, name, category_id, city_id, status, deleted_at")
      .eq("id", providerId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (provider?.category_id) {
      const slug = await categorySlugFromId(provider.category_id as string);
      const nameMap = await getCategoryNameMap();
      const catName = slug ? nameMap.get(slug) : null;
      const nameJson = provider.name as { ar?: string; en?: string } | string;
      const displayName =
        typeof nameJson === "string"
          ? nameJson
          : getLocalizedText(
              { ar: nameJson?.ar ?? "", en: nameJson?.en ?? "" },
              locale,
            ) || "Business";

      if (slug && catName) {
        targetProvider = {
          id: provider.id as string,
          name: displayName,
          categoryId: provider.category_id as string,
          categorySlug: slug,
          categoryLabel: getLocalizedText(catName, locale) || slug,
          cityId: (provider.city_id as string) ?? null,
        };
      }
    }
  }

  const returnQs = new URLSearchParams();
  if (sp.q?.trim()) returnQs.set("q", sp.q.trim());
  if (targetProvider) returnQs.set("providerId", targetProvider.id);
  const returnPath = returnQs.toString()
    ? `/request/new?${returnQs.toString()}`
    : "/request/new";
  const loginHref = `/login?redirect=${encodeURIComponent(returnPath)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {targetProvider ? t("targeted.pageTitle") : t("pageTitle")}
        </h1>
        <p className="text-muted-foreground">
          {targetProvider ? t("targeted.pageSubtitle") : t("pageSubtitle")}
        </p>
      </div>
      <IntentIntakeFlow
        initialIntent={sp.q?.trim() ?? ""}
        cities={cityOptions}
        loginHref={loginHref}
        isAuthenticated={Boolean(authUser)}
        visionEnabled={isAiEngineV5Enabled()}
        voiceEnabled={isAiEngineV6Enabled()}
        targetProvider={targetProvider}
      />
    </main>
  );
}
