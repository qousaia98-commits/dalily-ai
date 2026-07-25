import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import { listProviderOpportunities } from "@/domains/offer/queries";
import { WhyMatchedReasons } from "@/components/business/why-matched-reasons";
import { Link } from "@/lib/i18n/routing";
import { redirect } from "next/navigation";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";

export default async function BusinessOpportunitiesPage() {
  if (!isOffersV2Enabled()) {
    redirect("/business/requests");
  }

  const t = await getTranslations("offerFlow.provider");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  const opportunities = provider
    ? await listProviderOpportunities(provider.id)
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 animate-fade-in">
      {provider ? (
        <MarketplaceRealtimeBridge userId={authUser.id} providerId={provider.id} />
      ) : null}
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("listTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("listSubtitle")}</p>
      </header>

      {!provider ? (
        <p className="text-sm text-muted-foreground">{t("noProvider")}</p>
      ) : opportunities.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {opportunities.map((op) => (
            <li key={op.assignmentId}>
              <Link
                href={`/business/opportunities/${op.assignmentId}`}
                className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <p className="font-medium">{op.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {op.intentText}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {op.hasOffer ? t("statusOffered") : t("statusOpen")}
                  {op.urgency === "emergency" ? ` · ${t("emergency")}` : ""}
                </p>
                <WhyMatchedReasons reasons={op.reasons} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
