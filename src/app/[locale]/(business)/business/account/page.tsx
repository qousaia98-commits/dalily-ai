import {
  Bell,
  CreditCard,
  Languages,
  Star,
  User,
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
import type { PlanSlug } from "@/lib/subscription/types";

export default async function BusinessAccountPage() {
  const t = await getTranslations("mobilePages.businessAccount");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  let planSlug: PlanSlug = "free";
  if (provider) {
    try {
      const { subscription } = await getSubscriptionPageData(authUser.id);
      planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
    } catch {
      planSlug = "free";
    }
  }

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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <PlanBadge planSlug={planSlug} />
        </div>
        <p className="text-muted-foreground">
          {t("signedInAs", { name: authUser.displayName ?? authUser.email ?? "" })}
        </p>
      </div>

      <MobileHubLinks links={links} />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Languages className="size-4 text-[var(--dalily-gold)]" aria-hidden />
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
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">{t("theme")}</div>
          <ThemeToggle />
        </div>
      </section>

      <div className="[&_button]:min-h-12 [&_button]:w-full">
        <LogoutButton variant="outline" />
      </div>
    </div>
  );
}
