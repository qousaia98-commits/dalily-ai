import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  countTabBadges,
  listProviderRequests,
} from "@/lib/service-requests/queries";
import { BUSINESS_REQUEST_TABS } from "@/lib/service-requests/status-machine";
import { BusinessRequestsBoard } from "@/components/business/business-requests-board";
import type { BusinessRequestTab } from "@/lib/service-requests/status-machine";

export default async function BusinessRequestsPage() {
  const t = await getTranslations("business.requests");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  const emptyBadges = Object.fromEntries(
    BUSINESS_REQUEST_TABS.map((k) => [k, 0]),
  ) as Record<BusinessRequestTab, number>;

  const [all, badges] = provider
    ? await Promise.all([listProviderRequests(provider.id, "all"), countTabBadges(provider.id)])
    : [[], emptyBadges];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 overflow-x-hidden animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {provider ? (
        <BusinessRequestsBoard
          requests={all}
          badges={badges}
          userId={authUser.id}
          providerId={provider.id}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("noProvider")}</p>
      )}
    </div>
  );
}
