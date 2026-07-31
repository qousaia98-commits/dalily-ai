"use client";

import {
  Home,
  Sparkles,
  ClipboardList,
  MessageCircle,
  Wallet,
  UserRound,
  Menu,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/shared/plan-badge";
import { NavCountBadge } from "@/components/shared/nav-count-badge";
import { useMemo, useState } from "react";
import type { PlanSlug } from "@/lib/subscription/types";
import { getActiveNavigationItem } from "@/lib/navigation/active-item";

type SidebarBadgeKey =
  | "messages"
  | "requests"
  | "orders"
  | "opportunities"
  | "unlock"
  | "verification";

type NavItem = {
  id: string;
  href: string;
  icon: typeof Home;
  key: string;
  exact?: boolean;
  badgeKey?: SidebarBadgeKey;
  matchPrefixes?: readonly string[];
};

type BusinessSidebarProps = {
  planSlug?: PlanSlug | string;
  businessName?: string | null;
  badges?: Partial<Record<SidebarBadgeKey, number>>;
  showOpportunities?: boolean;
  showUnlock?: boolean;
  /** Kept for callers; simplified nav is always used. */
  marketplaceHome?: boolean;
};

const ACCOUNT_PREFIXES = [
  "/business/account",
  "/business/profile",
  "/business/services",
  "/business/media",
  "/business/availability",
  "/business/calendar",
  "/business/bookings",
  "/business/verification",
  "/business/quality",
  "/business/pricing",
  "/business/forecast",
  "/business/scheduling",
  "/business/assistant",
  "/business/settings",
  "/business/analytics",
  "/business/my-business",
] as const;

const PAYMENTS_PREFIXES = [
  "/business/payments",
  "/business/unlock",
] as const;

/**
 * Simplified provider navigation — 6 primary destinations.
 * Nested tools stay reachable via Account / Payments hubs.
 */
export function BusinessSidebar({
  planSlug = "free",
  businessName,
  badges = {},
  showOpportunities = false,
  showUnlock = false,
}: BusinessSidebarProps) {
  const t = useTranslations("business.nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo((): NavItem[] => {
    const newJobsHref = showOpportunities
      ? "/business/opportunities"
      : "/business/requests";

    return [
      {
        id: "dashboard",
        href: "/business",
        icon: Home,
        key: "dashboard",
        exact: true,
      },
      {
        id: "newJobs",
        href: newJobsHref,
        icon: Sparkles,
        key: "newJobs",
        badgeKey: showOpportunities ? "opportunities" : "requests",
        matchPrefixes: showOpportunities
          ? ["/business/opportunities"]
          : ["/business/requests"],
      },
      {
        id: "orders",
        href: "/business/orders",
        icon: ClipboardList,
        key: "orders",
        badgeKey: "orders",
        // When New Jobs owns /business/requests, do not also claim it here.
        matchPrefixes: showOpportunities
          ? ["/business/orders", "/business/requests"]
          : ["/business/orders"],
      },
      {
        id: "messages",
        href: "/business/messages",
        icon: MessageCircle,
        key: "messages",
        badgeKey: "messages",
      },
      {
        id: "payments",
        href: "/business/payments",
        icon: Wallet,
        key: "payments",
        badgeKey: showUnlock ? "unlock" : undefined,
        matchPrefixes: PAYMENTS_PREFIXES,
      },
      {
        id: "account",
        href: "/business/account",
        icon: UserRound,
        key: "account",
        badgeKey: "verification",
        matchPrefixes: ACCOUNT_PREFIXES,
      },
    ];
  }, [showOpportunities, showUnlock]);

  const activeItem = getActiveNavigationItem(pathname, navItems);

  const NavContent = () => (
    <nav className="flex flex-col gap-1" aria-label={t("title")}>
      {businessName ? (
        <div className="mb-3 space-y-2 rounded-2xl border border-border bg-muted/40 px-3 py-3">
          <p className="truncate text-sm font-bold text-foreground">{businessName}</p>
          <PlanBadge planSlug={planSlug} />
        </div>
      ) : null}
      {navItems.map((item) => {
        const { href, icon: Icon, key, badgeKey } = item;
        const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;
        const active = activeItem.id === item.id;
        return (
          <Link
            key={key}
            href={href}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t(key)}</span>
            <NavCountBadge count={badgeCount} />
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="mb-4 hidden md:block lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="gap-2"
        >
          <Menu className="size-4" />
          {t("menu")}
        </Button>
        {mobileOpen ? (
          <div className="mt-3 rounded-xl border bg-card p-3 shadow-sm">
            <NavContent />
          </div>
        ) : null}
      </div>

      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20 rounded-xl border border-border bg-card p-4">
          <p className="mb-4 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("title")}
          </p>
          <NavContent />
        </div>
      </aside>
    </>
  );
}
