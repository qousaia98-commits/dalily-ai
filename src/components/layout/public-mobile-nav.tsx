"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link, usePathname, useRouter } from "@/lib/i18n/routing";
import { localeNames, type Locale } from "@/lib/i18n/config";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DRAWER_DURATION_MS = 300;
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type PublicMobileNavProps = {
  isAuthenticated: boolean;
  isBusinessUser: boolean;
  isPlatformAdmin?: boolean;
  displayName?: string | null;
};

function DrawerDivider() {
  return <div className="mx-4 h-px bg-border" role="separator" />;
}

function DrawerNavLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-12 items-center rounded-xl px-4 text-base font-medium text-foreground transition-colors hover:bg-muted active:bg-muted"
    >
      {children}
    </Link>
  );
}

function DrawerSettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function MobileDrawerLanguageControl({ onChange }: { onChange?: () => void }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const setLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
    onChange?.();
  };

  return (
    <div className="inline-flex rounded-lg border border-border p-1">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "min-h-10 min-w-[5.5rem] rounded-md px-3 text-sm font-medium transition-colors",
          locale === "en" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
        )}
        aria-pressed={locale === "en"}
      >
        {localeNames.en}
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={cn(
          "min-h-10 min-w-[5.5rem] rounded-md px-3 text-sm font-medium transition-colors font-arabic",
          locale === "ar" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
        )}
        aria-pressed={locale === "ar"}
      >
        {localeNames.ar}
      </button>
    </div>
  );
}

function MobileDrawerThemeControl() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common");
  const isDark = resolvedTheme === "dark";

  return (
    <div className="inline-flex rounded-lg border border-border p-1">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "inline-flex min-h-10 min-w-[5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
          !isDark ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
        )}
        aria-pressed={!isDark}
      >
        <Sun className="size-4" />
        {t("light")}
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "inline-flex min-h-10 min-w-[5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
          isDark ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
        )}
        aria-pressed={isDark}
      >
        <Moon className="size-4" />
        {t("dark")}
      </button>
    </div>
  );
}

export function PublicMobileNav({
  isAuthenticated,
  isBusinessUser,
  isPlatformAdmin = false,
  displayName,
}: PublicMobileNavProps) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const closeMenu = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      triggerRef.current?.focus();
    }, DRAWER_DURATION_MS);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    setClosing(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((node) => node.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    const focusTimer = window.setTimeout(() => {
      const closeButton = drawerRef.current?.querySelector<HTMLElement>(
        '[data-mobile-drawer-close="true"]',
      );
      closeButton?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, closeMenu]);

  const drawerVisible = open || closing;

  const drawer = drawerVisible ? (
    <div className="fixed inset-0 z-[200] md:hidden" aria-hidden={!open}>
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/60",
          closing ? "animate-mobile-backdrop-out" : "animate-mobile-backdrop-in",
        )}
        aria-label={tNav("closeMenu")}
        tabIndex={-1}
        onClick={closeMenu}
      />

      <div
        id="public-mobile-nav"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={tNav("menu")}
        className={cn(
          "absolute inset-0 flex flex-col bg-background",
          closing ? "animate-mobile-drawer-out" : "animate-mobile-drawer-in",
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 pt-[max(env(safe-area-inset-top),0px)]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-mobile-drawer-close="true"
            className="size-12 shrink-0"
            aria-label={tNav("closeMenu")}
            onClick={closeMenu}
          >
            <X className="size-5" />
          </Button>
          <p className="text-lg font-semibold">{tNav("menu")}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),1rem)]">
          <nav className="flex flex-col gap-1 px-2 py-3" aria-label={tNav("menu")}>
            <DrawerNavLink href="/search" onNavigate={closeMenu}>
              {tNav("search")}
            </DrawerNavLink>

            {isPlatformAdmin ? (
              <DrawerNavLink href="/admin" onNavigate={closeMenu}>
                {tNav("admin")}
              </DrawerNavLink>
            ) : null}

            {isBusinessUser ? (
              <DrawerNavLink href="/business" onNavigate={closeMenu}>
                {tNav("dashboard")}
              </DrawerNavLink>
            ) : (
              <DrawerNavLink href="/register/business" onNavigate={closeMenu}>
                {tNav("forBusiness")}
              </DrawerNavLink>
            )}

            {isAuthenticated ? (
              <div className="space-y-2 px-2 py-1">
                {displayName ? (
                  <p className="truncate px-2 text-sm text-muted-foreground">{displayName}</p>
                ) : null}
                <div className="[&_button]:min-h-12 [&_button]:w-full [&_button]:justify-start [&_button]:px-4 [&_button]:text-base">
                  <LogoutButton variant="outline" />
                </div>
              </div>
            ) : (
              <>
                <DrawerNavLink href="/login" onNavigate={closeMenu}>
                  {tNav("login")}
                </DrawerNavLink>
                <DrawerNavLink href="/register" onNavigate={closeMenu}>
                  {tNav("register")}
                </DrawerNavLink>
              </>
            )}
          </nav>

          <DrawerDivider />

          <div className="flex flex-col gap-1 py-3">
            <DrawerSettingsRow label={tCommon("language")}>
              <MobileDrawerLanguageControl />
            </DrawerSettingsRow>
            <DrawerSettingsRow label={tCommon("theme")}>
              <MobileDrawerThemeControl />
            </DrawerSettingsRow>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="md:hidden">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-expanded={open}
        aria-controls="public-mobile-nav"
        aria-label={open ? tNav("closeMenu") : tNav("openMenu")}
        onClick={() => (open ? closeMenu() : openMenu())}
      >
        <Menu className="size-5" />
      </Button>

      {portalRoot && drawer ? createPortal(drawer, portalRoot) : null}
    </div>
  );
}
