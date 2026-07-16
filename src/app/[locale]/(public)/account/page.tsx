import {
  Building2,
  Languages,
  LogIn,
  Settings,
  UserPlus,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser, isPlatformAdmin } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";

export default async function AccountPage() {
  const t = await getTranslations("mobilePages.account");
  const authUser = await getAuthUser();
  const businessUser = authUser ? isBusinessUser(authUser.roles) : false;
  const platformAdmin = authUser ? isPlatformAdmin(authUser.roles) : false;

  const links = authUser
    ? [
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
