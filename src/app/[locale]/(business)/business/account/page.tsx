import {
  Bell,
  Clock3,
  Images,
  BarChart3,
  CalendarDays,
  CalendarClock,
  ShieldCheck,
  Settings,
  User,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PlanBadge } from "@/components/shared/plan-badge";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";
import { NavCountBadge } from "@/components/shared/nav-count-badge";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";
import { getProviderNavBadges } from "@/lib/badges";
import { markNavChannelNotificationsRead } from "@/lib/orders/notifications";
import type { PlanSlug } from "@/lib/subscription/types";

/**
 * Provider account hub — profile, services, availability, verification, settings,
 * and other tools that used to clutter the sidebar.
 *
 * Opening this hub clears the Account nav unread badge (verification channel).
 */
export default async function BusinessAccountPage() {
  const t = await getTranslations("mobilePages.businessAccount");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  let planSlug: PlanSlug = "free";
  let verificationBadge = 0;
  if (provider) {
    try {
      // Persist read state before counting so hub chrome does not re-show the pill.
      await markNavChannelNotificationsRead(authUser.id, "verification");
      const [{ subscription }, badges] = await Promise.all([
        getSubscriptionPageData(authUser.id),
        getProviderNavBadges(authUser.id),
      ]);
      planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
      verificationBadge = badges.verification;
    } catch {
      planSlug = "free";
    }
  }

  const primaryLinks = [
    {
      href: "/business/profile",
      title: t("links.profile"),
      description: t("links.profileDesc"),
      icon: User,
    },
    {
      href: "/business/services",
      title: t("links.services"),
      description: t("links.servicesDesc"),
      icon: Wrench,
    },
    {
      href: "/business/availability",
      title: t("links.availability"),
      description: t("links.availabilityDesc"),
      icon: Clock3,
    },
    {
      href: "/business/verification",
      title: t("links.verification"),
      description: t("links.verificationDesc"),
      icon: ShieldCheck,
    },
    {
      href: "/business/settings",
      title: t("links.settings"),
      description: t("links.settingsDesc"),
      icon: Settings,
    },
  ];

  const moreLinks = [
    {
      href: "/business/media",
      title: t("links.media"),
      description: t("links.mediaDesc"),
      icon: Images,
    },
    {
      href: "/business/calendar",
      title: t("links.calendar"),
      description: t("links.calendarDesc"),
      icon: CalendarDays,
    },
    {
      href: "/business/bookings",
      title: t("links.bookings"),
      description: t("links.bookingsDesc"),
      icon: CalendarClock,
    },
    {
      href: "/business/analytics",
      title: t("links.analytics"),
      description: t("links.analyticsDesc"),
      icon: BarChart3,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 animate-fade-in">
      <MarkNavChannelSeen channel="verification" />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          {verificationBadge > 0 ? <NavCountBadge count={verificationBadge} /> : null}
          <PlanBadge planSlug={planSlug} />
        </div>
        <p className="text-muted-foreground">
          {t("signedInAs", { name: authUser.displayName ?? authUser.email ?? "" })}
        </p>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.business")}
        </h2>
        <MobileHubLinks links={primaryLinks} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sections.more")}
        </h2>
        <MobileHubLinks links={moreLinks} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {t("language")}
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="size-4 text-[var(--dalily-gold)]" aria-hidden />
            {t("notifications")}
          </div>
          <span className="text-xs text-muted-foreground">{t("notificationsHint")}</span>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {t("theme")}
          </div>
          <ThemeToggle />
        </div>
      </section>

      <div className="[&_button]:min-h-12 [&_button]:w-full">
        <LogoutButton variant="outline" />
      </div>
    </div>
  );
}
