import {
  Building2,
  CalendarClock,
  ClipboardList,
  Languages,
  LogIn,
  Settings,
  ShieldAlert,
  UserPlus,
  Wallet,
  Sparkles,
} from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser, canAccessAdminPanel } from "@/lib/auth/roles";
import { isQualityCasesEnabled, isAiDynamicPricingEnabled, isForecastEngineEnabled, isAiSchedulingEnabled, isPaymentWalletEnabled, isAiAssistantEnabled } from "@/lib/config/feature-flags";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";
import { LocationSettings } from "@/components/account/location-settings";
import {
  NEARBY_LOC_COOKIE,
  parseNearbyLocCookie,
} from "@/lib/business/message-read-state";
import {
  LOC_PREF_COOKIE,
  parseLocationPreference,
} from "@/lib/geo/location-preference";

export default async function AccountPage() {
  const t = await getTranslations("mobilePages.account");
  const authUser = await getAuthUser();
  const businessUser = authUser ? isBusinessUser(authUser.roles) : false;
  const platformAdmin = authUser ? canAccessAdminPanel(authUser.roles) : false;
  const jar = await cookies();
  const locationPreference = parseLocationPreference(jar.get(LOC_PREF_COOKIE)?.value);
  const hasActiveLocation = Boolean(
    parseNearbyLocCookie(jar.get(NEARBY_LOC_COOKIE)?.value),
  );

  const links = authUser
    ? [
        {
          href: "/account/orders",
          title: t("links.myRequests"),
          description: t("links.myRequestsDesc"),
          icon: ClipboardList,
        },
        {
          href: "/account/bookings",
          title: t("links.myBookings"),
          description: t("links.myBookingsDesc"),
          icon: CalendarClock,
        },
        ...(isPaymentWalletEnabled()
          ? [
              {
                href: "/account/wallet",
                title: t("links.wallet"),
                description: t("links.walletDesc"),
                icon: Wallet,
              },
            ]
          : []),
        ...(isAiAssistantEnabled()
          ? [
              {
                href: "/account/assistant",
                title: t("links.assistant"),
                description: t("links.assistantDesc"),
                icon: Sparkles,
              },
            ]
          : []),
        ...(isQualityCasesEnabled()
          ? [
              {
                href: "/account/quality",
                title: t("links.quality"),
                description: t("links.qualityDesc"),
                icon: ShieldAlert,
              },
            ]
          : []),
        ...(isAiDynamicPricingEnabled()
          ? [
              {
                href: "/account/pricing",
                title: t("links.pricing"),
                description: t("links.pricingDesc"),
                icon: ClipboardList,
              },
            ]
          : []),
        ...(isForecastEngineEnabled()
          ? [
              {
                href: "/account/forecast",
                title: t("links.forecast"),
                description: t("links.forecastDesc"),
                icon: CalendarClock,
              },
            ]
          : []),
        ...(isAiSchedulingEnabled()
          ? [
              {
                href: "/account/scheduling",
                title: t("links.scheduling"),
                description: t("links.schedulingDesc"),
                icon: CalendarClock,
              },
            ]
          : []),
        ...(platformAdmin
          ? [
              {
                href: "/admin",
                title: t("links.admin"),
                description: t("links.adminDesc"),
                icon: Settings,
              },
            ]
          : []),
        ...(businessUser
          ? [
              {
                href: "/business",
                title: t("links.business"),
                description: t("links.businessDesc"),
                icon: Building2,
              },
              {
                href: "/business/settings",
                title: t("links.requestSettings") ?? "Request settings",
                description: t("links.requestSettingsDesc") ?? "Manage how customers contact you",
                icon: Settings,
              },
            ]
          : [
              {
                href: "/register/business",
                title: t("links.forBusiness"),
                description: t("links.forBusinessDesc"),
                icon: Building2,
              },
            ]),
      ]
    : [
        {
          href: "/login",
          title: t("links.login"),
          description: t("links.loginDesc"),
          icon: LogIn,
        },
        {
          href: "/register",
          title: t("links.register"),
          description: t("links.registerDesc"),
          icon: UserPlus,
        },
        {
          href: "/register/business",
          title: t("links.forBusiness"),
          description: t("links.forBusinessDesc"),
          icon: Building2,
        },
      ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {authUser
            ? t("signedInAs", { name: authUser.displayName ?? authUser.email ?? "" })
            : t("subtitle")}
        </p>
      </div>

      <MobileHubLinks links={links} />

      <LocationSettings
        preference={locationPreference}
        hasActiveLocation={hasActiveLocation}
      />

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Languages className="size-4 text-[var(--dalily-gold)]" aria-hidden />
            {t("language")}
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings className="size-4 text-[var(--dalily-gold)]" aria-hidden />
            {t("theme")}
          </div>
          <ThemeToggle />
        </div>
      </section>

      {authUser ? (
        <div className="[&_button]:min-h-12 [&_button]:w-full">
          <LogoutButton variant="outline" />
        </div>
      ) : null}
    </div>
  );
}
