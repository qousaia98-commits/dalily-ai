import { getLocale, getTranslations } from "next-intl/server";
import type { ControlCenterOverview } from "@/lib/admin/control-center";
import { requireAdminUser } from "@/lib/auth/session";
import { buildPersonalizedGreeting } from "@/lib/greetings";
import type { Locale } from "@/lib/i18n/config";
import { totalAttention } from "@/lib/admin/ops-health";

export async function ControlCenterHero({ overview }: { overview: ControlCenterOverview }) {
  const t = await getTranslations("admin.controlCenter.hero");
  const locale = (await getLocale()) as Locale;
  const authUser = await requireAdminUser();
  const greeting = buildPersonalizedGreeting({
    roles: authUser.roles,
    displayName: authUser.displayName,
    email: authUser.email,
    locale,
    userId: authUser.id,
  });

  const attention = totalAttention({
    pendingBusinesses: overview.pendingBusinesses,
    pendingPayments: overview.pendingPayments,
    pendingVerifications: overview.pendingVerifications,
    openIssues: overview.openIssues,
    changesRequested: overview.changesRequested,
    unreadMessages: overview.unreadMessages,
  });

  return (
    <header className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-[linear-gradient(145deg,#0B1526_0%,#1a2744_100%)] px-5 py-7 text-white shadow-sm sm:rounded-[2rem] sm:px-8 sm:py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-12 -top-12 size-44 rounded-full bg-[var(--dalily-gold)]/18 blur-3xl"
      />
      <div className="relative space-y-3">
        <p className="text-[0.7rem] font-bold tracking-[0.18em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {greeting.title}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
          {attention > 0
            ? t("subtitleAttention", { count: attention })
            : greeting.subtitle}
        </p>
      </div>
    </header>
  );
}
