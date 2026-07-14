import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser, isPlatformAdmin } from "@/lib/auth/roles";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { PublicMobileNav } from "@/components/layout/public-mobile-nav";
import { DalilyLogo } from "@/components/brand/dalily-logo";
import { Button } from "@/components/ui/button";

export async function AppHeader() {
  const t = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const authUser = await getAuthUser();
  const businessUser = authUser ? isBusinessUser(authUser.roles) : false;
  const platformAdmin = authUser ? isPlatformAdmin(authUser.roles) : false;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("brand")}
        >
          <DalilyLogo variant="full" className="hidden sm:inline-flex" />
          <DalilyLogo variant="compact" className="sm:hidden" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={tNav("menu")}>
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

        <div className="flex items-center gap-1 sm:gap-2">
          <PublicMobileNav
            isAuthenticated={Boolean(authUser)}
            isBusinessUser={businessUser}
            displayName={authUser?.displayName ?? authUser?.email ?? null}
          />

          {authUser ? (
            <>
              <span className="hidden max-w-[8rem] truncate text-sm text-muted-foreground md:inline">
                {authUser.displayName ?? authUser.email}
              </span>
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
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
