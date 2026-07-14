"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicMobileNavProps = {
  isAuthenticated: boolean;
  isBusinessUser: boolean;
  displayName?: string | null;
};

export function PublicMobileNav({
  isAuthenticated,
  isBusinessUser,
  displayName,
}: PublicMobileNavProps) {
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const navLinks = [
    { href: "/search", label: tNav("search") },
    isBusinessUser
      ? { href: "/business", label: tNav("dashboard") }
      : { href: "/register/business", label: tNav("forBusiness") },
  ] as const;

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-expanded={open}
        aria-controls="public-mobile-nav"
        aria-label={open ? tNav("closeMenu") : tNav("openMenu")}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            aria-label={tNav("closeMenu")}
            onClick={() => setOpen(false)}
          />
          <div
            id="public-mobile-nav"
            className={cn(
              "fixed inset-y-0 z-50 w-[min(100vw-3rem,20rem)] border-border bg-background p-4 shadow-xl",
              "end-0 border-s animate-fade-in",
            )}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-semibold">{tNav("menu")}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label={tNav("closeMenu")}
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>

            <nav className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 space-y-3 border-t pt-6">
              {isAuthenticated ? (
                <>
                  {displayName ? (
                    <p className="truncate px-3 text-sm text-muted-foreground">{displayName}</p>
                  ) : null}
                  <LogoutButton variant="outline" />
                </>
              ) : (
                <>
                  <Button asChild className="w-full" variant="outline">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      {tNav("login")}
                    </Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/register" onClick={() => setOpen(false)}>
                      {tNav("register")}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
