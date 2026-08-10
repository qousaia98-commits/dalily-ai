import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  isUnlockDevBypassEnabled,
  isUnlockV2Enabled,
  isProviderMonetizationEnabled,
} from "@/lib/config/feature-flags";
import { listProviderUnlockSessions } from "@/domains/unlock/session";
import { Link } from "@/lib/i18n/navigation";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";

export default async function BusinessUnlockListPage() {
  if (!isUnlockV2Enabled()) redirect("/business/opportunities");
  // Flat $5/mo model: contact never gates on a per-unlock payment — this
  // list has nothing meaningful to show, send providers to the real
  // subscription/payments surfaces instead.
  if (isProviderMonetizationEnabled()) redirect("/business/payments");

  const t = await getTranslations("unlockFlow.provider");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  const sessions = provider ? await listProviderUnlockSessions(provider.id) : [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 animate-fade-in">
      <MarkNavChannelSeen channel="unlock" />
      {provider ? (
        <MarketplaceRealtimeBridge userId={authUser.id} providerId={provider.id} />
      ) : null}
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("listTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("listSubtitle")}</p>
        {isUnlockDevBypassEnabled() ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{t("devBypassHint")}</p>
        ) : null}
      </header>

      {!provider ? (
        <p className="text-sm text-muted-foreground">{t("noProvider")}</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/business/unlock/${s.id}`}
                className="block rounded-2xl border border-border px-4 py-3 hover:bg-muted/40"
              >
                <p className="font-medium">{t(`status.${s.status}`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("fee", { amount: s.feeAmount, currency: s.feeCurrency })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
