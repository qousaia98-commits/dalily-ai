import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import { listProviderOpportunities } from "@/domains/offer/queries";
import { OpportunityRequestCard } from "@/components/business/opportunity-request-card";
import { redirect } from "next/navigation";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";

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
      <MarkNavChannelSeen channel="opportunities" />
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
              <OpportunityRequestCard opportunity={op} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
