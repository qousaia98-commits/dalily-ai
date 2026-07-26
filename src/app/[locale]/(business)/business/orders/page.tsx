import { getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { listProviderRequests } from "@/lib/service-requests/queries";
import { countProviderOrderTabs } from "@/lib/orders/tabs";
import { OrdersBoard } from "@/components/orders/orders-board";
import { Link } from "@/lib/i18n/routing";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import { listProviderOpportunities } from "@/domains/offer/queries";

export default async function ProviderOrdersPage() {
  const t = await getTranslations("orders");
  const tNav = await getTranslations("business.nav");
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
  const openOps = opportunities.filter((o) => !o.hasOffer).length;

  const sectionChips = [
    { key: "waiting", label: t("providerTabs.waiting"), count: tabCounts.waiting },
    { key: "active", label: t("providerTabs.active"), count: tabCounts.active },
    { key: "completed", label: t("providerTabs.completed"), count: tabCounts.completed },
    { key: "cancelled", label: t("providerTabs.cancelled"), count: tabCounts.cancelled },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("providerEyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("providerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("providerSubtitle")}</p>
        {offersOn ? (
          <p className="pt-1 text-sm">
            <Link
              href="/business/opportunities"
              className="font-semibold text-[var(--dalily-gold)] hover:underline"
            >
              {tNav("newJobs")}
              {openOps > 0 ? ` (${openOps})` : ""}
            </Link>
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2" role="list" aria-label={t("providerTitle")}>
        {sectionChips.map((chip) => (
          <span
            key={chip.key}
            role="listitem"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm"
          >
            <span className="text-muted-foreground">{chip.label}</span>
            <span className="tabular-nums font-bold text-foreground">{chip.count}</span>
          </span>
        ))}
      </div>

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
