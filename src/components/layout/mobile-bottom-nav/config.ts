import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  MessageCircle,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { MobileNavItemConfig, MobileNavRole } from "./types";
import {
  getActiveNavigationItem,
  getNavigationMatchScore,
  isNavigationItemActive,
} from "@/lib/navigation/active-item";

/** Customer (and guest) — marketplace discovery + own orders. */
export const CUSTOMER_NAV_ITEMS: readonly MobileNavItemConfig[] = [
  { id: "home", href: "/", icon: Home, labelKey: "home", exact: true },
  { id: "search", href: "/search", icon: Search, labelKey: "search" },
  {
    id: "orders",
    href: "/account/orders",
    icon: ClipboardList,
    labelKey: "orders",
    badgeKey: "orders",
    matchPrefixes: ["/account/orders", "/account/requests", "/request"],
  },
  {
    id: "messages",
    href: "/messages",
    icon: MessageCircle,
    labelKey: "messages",
    badgeKey: "messages",
    matchPrefixes: ["/messages"],
  },
  {
    id: "account",
    href: "/account",
    icon: UserRound,
    labelKey: "account",
    // Profile hub only — /account/orders wins via longer prefix exclusivity.
    matchPrefixes: ["/account"],
  },
] as const;

/** @deprecated Use CUSTOMER_NAV_ITEMS — kept as alias for older imports. */
export const GUEST_NAV_ITEMS = CUSTOMER_NAV_ITEMS;

/**
 * Provider mobile nav (5 tabs) — mirrors simplified desktop spine.
 * Payments live under Account hub on small screens.
 */
export const BUSINESS_NAV_ITEMS: readonly MobileNavItemConfig[] = [
  {
    id: "dashboard",
    href: "/business",
    icon: Home,
    labelKey: "dashboard",
    exact: true,
  },
  {
    id: "newJobs",
    href: "/business/opportunities",
    icon: Sparkles,
    labelKey: "newJobs",
    badgeKey: "opportunities",
    matchPrefixes: ["/business/opportunities"],
  },
  {
    id: "orders",
    href: "/business/orders",
    icon: ClipboardList,
    labelKey: "orders",
    badgeKey: "orders",
    matchPrefixes: ["/business/orders", "/business/requests"],
  },
  {
    id: "messages",
    href: "/business/messages",
    icon: MessageCircle,
    labelKey: "messages",
    badgeKey: "messages",
  },
  {
    id: "account",
    href: "/business/account",
    icon: UserRound,
    labelKey: "account",
    badgeKey: "verification",
    matchPrefixes: [
      "/business/account",
      "/business/profile",
      "/business/services",
      "/business/media",
      "/business/availability",
      "/business/calendar",
      "/business/bookings",
      "/business/verification",
      "/business/settings",
      "/business/analytics",
      "/business/payments",
      "/business/unlock",
      "/business/my-business",
    ],
  },
] as const;

export function getBusinessMarketplaceNavItems(opts?: {
  showOpportunities?: boolean;
  showUnlock?: boolean;
}): readonly MobileNavItemConfig[] {
  void opts?.showUnlock;
  if (opts?.showOpportunities === false) {
    // When New Jobs owns /business/requests, Orders must not also claim it.
    return BUSINESS_NAV_ITEMS.map((item) => {
      if (item.id === "newJobs") {
        return {
          ...item,
          href: "/business/requests",
          badgeKey: "requests" as const,
          matchPrefixes: ["/business/requests"],
        };
      }
      if (item.id === "orders") {
        return {
          ...item,
          matchPrefixes: ["/business/orders"],
        };
      }
      return item;
    });
  }
  return BUSINESS_NAV_ITEMS;
}

export const ADMIN_NAV_ITEMS: readonly MobileNavItemConfig[] = [
  {
    id: "control",
    href: "/admin",
    icon: LayoutDashboard,
    labelKey: "controlCenter",
    exact: true,
  },
  {
    id: "approvals",
    href: "/admin/providers",
    icon: CheckCircle2,
    labelKey: "approvals",
    badgeKey: "approvals",
    matchPrefixes: ["/admin/providers", "/admin/verification"],
  },
  {
    id: "payments",
    href: "/admin/payments",
    icon: CreditCard,
    labelKey: "payments",
    badgeKey: "payments",
  },
  {
    id: "issues",
    href: "/admin/issues",
    icon: AlertTriangle,
    labelKey: "issues",
    badgeKey: "issues",
    matchPrefixes: ["/admin/issues", "/admin/reviews"],
  },
  {
    id: "admin",
    href: "/admin/settings",
    icon: UserRound,
    labelKey: "admin",
    matchPrefixes: [
      "/admin/settings",
      "/admin/categories",
      "/admin/users",
      "/admin/subscriptions",
      "/admin/searches",
      "/admin/messages",
      "/admin/audit",
      "/admin/health",
      "/admin/analytics",
      "/admin/marketplace",
    ],
  },
] as const;

export function getMobileNavItems(
  role: MobileNavRole,
  opts?: {
    marketplaceHome?: boolean;
    showOpportunities?: boolean;
    showUnlock?: boolean;
  },
): readonly MobileNavItemConfig[] {
  switch (role) {
    case "business":
      return getBusinessMarketplaceNavItems({
        showOpportunities: opts?.showOpportunities !== false,
        showUnlock: Boolean(opts?.showUnlock),
      });
    case "admin":
      return ADMIN_NAV_ITEMS;
    case "customer":
    case "guest":
    default:
      return CUSTOMER_NAV_ITEMS;
  }
}

export function isMobileNavItemActive(
  pathname: string,
  item: MobileNavItemConfig,
  items?: readonly MobileNavItemConfig[],
): boolean {
  if (items) {
    return isNavigationItemActive(pathname, item, items);
  }
  // Single-item probe: score only — do not use getActiveNavigationItem([item]),
  // which would fall back to that item and always look "active".
  return getNavigationMatchScore(pathname, item) > 0;
}

/** Exclusive active item for the current mobile nav set (always defined). */
export function getActiveMobileNavItem(
  pathname: string,
  items: readonly MobileNavItemConfig[],
): MobileNavItemConfig {
  return getActiveNavigationItem(pathname, items);
}
