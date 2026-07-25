import { getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { listProviderRequests } from "@/lib/service-requests/queries";
import { countProviderOrderTabs } from "@/lib/orders/tabs";
import { OrdersBoard } from "@/components/orders/orders-board";
import { Link } from "@/lib/i18n/routing";
import { isOffersV2Enabled, isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { listProviderOpportunities } from "@/domains/offer/queries";
import { Badge } from "@/components/ui/badge";

export default async function ProviderOrdersPage() {
  const t = await getTranslations("orders");
  const tNav = await getTranslations("business.nav");
  const tOffer = await getTranslations("offerFlow.provider");
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const provider = await getOwnedProvider(authUser.id);
  if (!provider) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  const offersOn = isOffersV2Enabled();
  const [requests, opportunities] = await Promise.all([
    listProviderRequests(provider.id, "all"),
    offersOn ? listProviderOpportunities(provider.id) : Promise.resolve([]),
  ]);
  const tabCounts = countProviderOrderTabs(requests);
  const openOps = opportunities.filter((o) => !o.hasOffer);
  const offeredOps = opportunities.filter((o) => o.hasOffer);
  tabCounts.new += openOps.length;
  tabCounts.offers += offeredOps.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("providerEyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("providerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("providerSubtitle")}</p>
        <div className="flex flex-wrap gap-3 pt-1 text-sm">
          {offersOn ? (
            <Link
              href="/business/opportunities"
              className="font-semibold text-[var(--dalily-gold)] hover:underline"
            >
              {tNav("opportunities")}
            </Link>
          ) : null}
          {isUnlockV2Enabled() ? (
            <Link
              href="/business/unlock"
              className="font-semibold text-[var(--dalily-gold)] hover:underline"
            >
              {tNav("unlock")}
            </Link>
          ) : null}
        </div>
      </header>

      {offersOn && opportunities.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {t("providerTabs.new")}
          </h2>
          <ul className="space-y-3">
            {opportunities.map((op) => (
              <li key={op.assignmentId}>
                <Link
                  href={`/business/opportunities/${op.assignmentId}`}
                  className="block rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:border-[var(--dalily-gold)]/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{op.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {op.intentText}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {op.hasOffer ? tOffer("statusOffered") : tOffer("statusOpen")}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <OrdersBoard
        mode="provider"
        requests={requests}
        tabCounts={tabCounts}
        userId={authUser.id}
        providerId={provider.id}
        detailBasePath="/business/requests"
      />
    </div>
  );
}
