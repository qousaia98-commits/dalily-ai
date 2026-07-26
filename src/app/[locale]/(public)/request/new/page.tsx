import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isCustomerIntentFlowV2Enabled } from "@/lib/config/feature-flags";
import { getAuthUser } from "@/lib/auth/session";
import { getActiveCities } from "@/lib/geo/cities";
import { getLocalizedText } from "@/types/domain.types";
import { IntentIntakeFlow } from "@/components/customer/intent-intake-flow";
import type { Locale } from "@/lib/i18n/config";
import {
  isAiEngineV5Enabled,
  isAiEngineV6Enabled,
} from "@/lib/config/feature-flags";

export default async function NewIntentRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  if (!isCustomerIntentFlowV2Enabled()) {
    redirect("/");
  }

  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  const { q } = await searchParams;
  const t = await getTranslations("intentFlow");
  const authUser = await getAuthUser();
  const cities = await getActiveCities();

  const cityOptions = cities.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: getLocalizedText(c.name, locale) || c.slug,
  }));

  const returnPath = q?.trim()
    ? `/request/new?q=${encodeURIComponent(q.trim())}`
    : "/request/new";
  const loginHref = `/login?redirect=${encodeURIComponent(returnPath)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
      </div>
      <IntentIntakeFlow
        initialIntent={q?.trim() ?? ""}
        cities={cityOptions}
        loginHref={loginHref}
        isAuthenticated={Boolean(authUser)}
        visionEnabled={isAiEngineV5Enabled()}
        voiceEnabled={isAiEngineV6Enabled()}
      />
    </main>
  );
}
