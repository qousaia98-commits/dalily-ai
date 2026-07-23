import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser, canAccessAdminPanel } from "@/lib/auth/roles";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { DalilyLogo } from "@/components/brand/dalily-logo";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  /** When set, replaces personal account name (business dashboard). */
  businessLabel?: string | null;
  /** Optional plan badge next to business label. */
  businessPlanBadge?: ReactNode;
};

export async function AppHeader({
  businessLabel,
  businessPlanBadge,
}: AppHeaderProps = {}) {
  const t = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const authUser = await getAuthUser();
  const businessUser = authUser ? isBusinessUser(authUser.roles) : false;
  const platformAdmin = authUser ? canAccessAdminPanel(authUser.roles) : false;

  const accountLabel =
    businessLabel !== undefined
      ? businessLabel
      : (authUser?.displayName ?? authUser?.email ?? null);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:h-[4.5rem] sm:px-6">
        <Link
          href="/"
          className="justify-self-start rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("brand")}
        >
          <DalilyLogo variant="horizontal" className="hidden lg:inline-flex" />
          <DalilyLogo variant="full" className="hidden sm:inline-flex lg:hidden" />
          <DalilyLogo variant="compact" className="sm:hidden" />
        </Link>

        <nav
          className="hidden items-center justify-center gap-1 md:flex"
          aria-label={tNav("menu")}
        >
          <Button variant="ghost" size="sm" asChild>
            <Link href="/search">{tNav("search")}</Link>
          </Button>
          {platformAdmin ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">{tNav("admin")}</Link>
            </Button>
          ) : null}
          {authUser && businessUser ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/business">{tNav("dashboard")}</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/register/business">{tNav("forBusiness")}</Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          {authUser ? (
            <>
              {accountLabel ? (
                <span className="hidden max-w-[16rem] items-center gap-2 truncate text-sm text-muted-foreground lg:inline-flex">
                  <span className="truncate">{accountLabel}</span>
                  {businessPlanBadge}
                </span>
              ) : null}
              <div className="hidden md:block">
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
                <Link href="/login">{tNav("login")}</Link>
              </Button>
              <Button size="sm" className="hidden md:inline-flex" asChild>
                <Link href="/register">{tNav("register")}</Link>
              </Button>
            </>
          )}
          <LanguageSwitcher className="hidden md:inline-flex" />
          <ThemeToggle className="hidden md:inline-flex" />
        </div>
      </div>
    </header>
  );
}
