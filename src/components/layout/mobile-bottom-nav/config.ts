import {
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Search,
  UserRound,
} from "lucide-react";
import type { MobileNavItemConfig, MobileNavRole } from "./types";

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
  { id: "account", href: "/account", icon: UserRound, labelKey: "account" },
] as const;

/** @deprecated Use CUSTOMER_NAV_ITEMS — kept as alias for older imports. */
export const GUEST_NAV_ITEMS = CUSTOMER_NAV_ITEMS;

/**
 * Provider mobile nav — never includes customer search/marketplace discovery.
 * Dashboard · My Jobs · Messages · Account
 */
export const BUSINESS_NAV_ITEMS: readonly MobileNavItemConfig[] = [
  {
    id: "dashboard",
    href: "/business",
    icon: LayoutDashboard,
    labelKey: "dashboard",
    exact: true,
  },
  {
    id: "orders",
    href: "/business/orders",
    icon: ClipboardList,
    labelKey: "orders",
    badgeKey: "orders",
    matchPrefixes: [
      "/business/orders",
      "/business/requests",
      "/business/opportunities",
      "/business/unlock",
    ],
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
  },
] as const;

/** Sprint 8 marketplace home — same 4-tab spine; My Jobs stays the hub. */
export function getBusinessMarketplaceNavItems(_opts?: {
  showOpportunities?: boolean;
  showUnlock?: boolean;
}): readonly MobileNavItemConfig[] {
  void _opts;
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
    id: "marketplace",
    href: "/admin/marketplace",
    icon: Megaphone,
    labelKey: "marketplace",
    matchPrefixes: ["/admin/marketplace"],
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
      if (opts?.marketplaceHome) {
        return getBusinessMarketplaceNavItems({
          showOpportunities: Boolean(opts.showOpportunities),
          showUnlock: Boolean(opts.showUnlock),
        });
      }
      return BUSINESS_NAV_ITEMS;
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
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return Boolean(
    item.matchPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
}
