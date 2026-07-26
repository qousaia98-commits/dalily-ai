import { KeyRound, Star, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { listProviderUnlockSessions } from "@/domains/unlock/session";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";
import { NavCountBadge } from "@/components/shared/nav-count-badge";
import { Link } from "@/lib/i18n/routing";

/**
 * Payments hub — unlocks, subscription payments, and earnings entry points.
 * Reuses existing unlock + subscription routes (no duplicated payment logic).
 */
export default async function BusinessPaymentsPage() {
  const t = await getTranslations("business.paymentsHub");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  let unlockPending = 0;
  if (provider && isUnlockV2Enabled()) {
    try {
      const sessions = await listProviderUnlockSessions(provider.id);
      unlockPending = sessions.filter(
        (s) => s.status === "opened" || s.status === "payment_pending",
      ).length;
    } catch {
      unlockPending = 0;
    }
  }

  const links = [
    ...(isUnlockV2Enabled()
      ? [
          {
            href: "/business/unlock",
            title: t("links.unlock"),
            description: t("links.unlockDesc"),
            icon: KeyRound,
          },
        ]
      : []),
    {
      href: "/business/subscription",
      title: t("links.subscription"),
      description: t("links.subscriptionDesc"),
      icon: Star,
    },
    {
      href: "/business/subscription#payments",
      title: t("links.history"),
      description: t("links.historyDesc"),
      icon: Wallet,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 animate-fade-in">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <NavCountBadge count={unlockPending} />
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {unlockPending > 0 ? (
        <div
          className="rounded-2xl border border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium">{t("priorityTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("priorityBody", { count: unlockPending })}
          </p>
          <Link
            href="/business/unlock"
            className="mt-2 inline-block font-semibold text-[var(--dalily-gold)] hover:underline"
          >
            {t("priorityCta")}
          </Link>
        </div>
      ) : null}

      <MobileHubLinks links={links} />
    </div>
  );
}
