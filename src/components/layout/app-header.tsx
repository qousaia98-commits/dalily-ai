import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { PublicMobileNav } from "@/components/layout/public-mobile-nav";
import { Button } from "@/components/ui/button";

export async function AppHeader() {
  const t = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const authUser = await getAuthUser();
  const businessUser = authUser ? isBusinessUser(authUser.roles) : false;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("brand")}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground sm:size-9">
            د
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold tracking-tight sm:text-base">{t("brand")}</span>
            <span className="hidden text-xs text-muted-foreground md:block">{t("tagline")}</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={tNav("menu")}>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/search">{tNav("search")}</Link>
          </Button>
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
