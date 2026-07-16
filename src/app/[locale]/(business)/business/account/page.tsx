import {
  Bell,
  CreditCard,
  Languages,
  Star,
  User,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";

export default async function BusinessAccountPage() {
  const t = await getTranslations("mobilePages.businessAccount");
  const authUser = await requireAuthUser();

  const links = [
    {
      href: "/business/profile",
      title: t("links.profile"),
      description: t("links.profileDesc"),
      icon: User,
    },
    {
      href: "/business/subscription",
      title: t("links.subscription"),
      description: t("links.subscriptionDesc"),
      icon: Star,
    },
    {
      href: "/business/subscription#payments",
      title: t("links.payments"),
      description: t("links.paymentsDesc"),
      icon: CreditCard,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("signedInAs", { name: authUser.displayName ?? authUser.email ?? "" })}
        </p>
      </div>

      <MobileHubLinks links={links} />

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
            <Bell className="size-4 text-[var(--dalily-gold)]" aria-hidden />
            {t("notifications")}
          </div>
          <span className="text-xs text-muted-foreground">{t("notificationsHint")}</span>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex items-center gap-2 text-sm font-medium">{t("theme")}</div>
          <ThemeToggle />
        </div>
      </section>

      <div className="[&_button]:min-h-12 [&_button]:w-full">
        <LogoutButton variant="outline" />
      </div>
    </div>
  );
}
