"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { getMobileNavItems, isMobileNavItemActive } from "./config";
import type { MobileNavBadges, MobileNavRole } from "./types";

type MobileBottomNavProps = {
  role: MobileNavRole;
  badges?: MobileNavBadges;
};

function formatBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

export function MobileBottomNav({ role, badges = {} }: MobileBottomNavProps) {
  const t = useTranslations(`mobileNav.${role}`);
  const tA11y = useTranslations("mobileNav.a11y");
  const pathname = usePathname();
  const items = getMobileNavItems(role);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);

  const handlePressStart = useCallback((id: string) => {
    setPressedId(id);
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  }, []);

  const handlePressEnd = useCallback((id: string) => {
    pressTimer.current = window.setTimeout(() => {
      setPressedId((current) => (current === id ? null : current));
    }, 120);
  }, []);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] md:hidden"
      aria-label={tA11y("label")}
    >
      <div className="px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex h-[4.75rem] max-w-md items-stretch justify-between gap-0.5",
            "rounded-[1.75rem] border border-border/40 bg-background/75 px-1.5 shadow-[0_10px_40px_rgba(11,21,38,0.14)]",
            "backdrop-blur-xl backdrop-saturate-150",
            "dark:border-white/10 dark:bg-[color-mix(in_oklab,var(--dalily-navy-deep)_78%,transparent)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.45)]",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = isMobileNavItemActive(pathname, item);
            const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
            const label = t(item.labelKey);
            const pressed = pressedId === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={
                  badgeCount > 0
                    ? tA11y("withBadge", { label, count: badgeCount })
                    : label
                }
                aria-current={active ? "page" : undefined}
                onPointerDown={() => handlePressStart(item.id)}
                onPointerUp={() => handlePressEnd(item.id)}
                onPointerCancel={() => handlePressEnd(item.id)}
                onPointerLeave={() => handlePressEnd(item.id)}
                className={cn(
                  "relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1",
                  "outline-none transition-[transform,color,background-color] duration-200 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "motion-safe:active:scale-[0.92]",
                  pressed && "motion-safe:scale-[0.92]",
                  active
                    ? "text-[var(--dalily-gold)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative inline-flex size-7 items-center justify-center">
                  <Icon
                    className={cn(
                      "size-[1.35rem] transition-transform duration-200 ease-out",
                      active && "motion-safe:scale-110",
                    )}
                    strokeWidth={active ? 2.35 : 1.85}
                    aria-hidden
                  />
                  {badgeCount > 0 ? (
                    <span
                      className={cn(
                        "absolute -end-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1",
                        "bg-[var(--dalily-gold)] text-[0.625rem] font-bold leading-none text-[var(--dalily-navy)]",
                        "ring-2 ring-background",
                      )}
                      aria-hidden
                    >
                      {formatBadge(badgeCount)}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-[0.625rem] font-medium leading-tight tracking-wide",
                    active && "font-semibold",
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-[var(--dalily-gold)] transition-all duration-300 ease-out",
                    active
                      ? "scale-x-100 opacity-100"
                      : "scale-x-0 opacity-0 motion-reduce:transition-none",
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
