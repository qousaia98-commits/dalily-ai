import {
  Building2,
  CheckCircle2,
  CreditCard,
  Heart,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { MobileNavItemConfig, MobileNavRole } from "./types";

export const GUEST_NAV_ITEMS: readonly MobileNavItemConfig[] = [
  { id: "home", href: "/", icon: Home, labelKey: "home", exact: true },
  { id: "search", href: "/search", icon: Search, labelKey: "search" },
  { id: "ai", href: "/ai", icon: Sparkles, labelKey: "aiSearch" },
  { id: "favorites", href: "/favorites", icon: Heart, labelKey: "favorites" },
  { id: "account", href: "/account", icon: UserRound, labelKey: "account" },
] as const;

export const BUSINESS_NAV_ITEMS: readonly MobileNavItemConfig[] = [
  {
    id: "dashboard",
    href: "/business",
    icon: LayoutDashboard,
    labelKey: "dashboard",
    exact: true,
  },
  {
    id: "myBusiness",
    href: "/business/my-business",
    icon: Building2,
    labelKey: "myBusiness",
    matchPrefixes: [
      "/business/my-business",
      "/business/profile",
      "/business/gallery",
      "/business/services",
      "/business/verification",
      "/business/welcome",
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
    id: "growth",
    href: "/business/analytics",
    icon: TrendingUp,
    labelKey: "growth",
    matchPrefixes: ["/business/analytics", "/business/subscription"],
  },
  {
    id: "account",
    href: "/business/account",
    icon: UserRound,
    labelKey: "account",
  },
] as const;

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
    id: "messages",
    href: "/admin/messages",
    icon: Megaphone,
    labelKey: "messages",
    badgeKey: "messages",
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
    ],
  },
] as const;

export function getMobileNavItems(role: MobileNavRole): readonly MobileNavItemConfig[] {
  switch (role) {
    case "business":
      return BUSINESS_NAV_ITEMS;
    case "admin":
      return ADMIN_NAV_ITEMS;
    default:
      return GUEST_NAV_ITEMS;
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

  return Boolean(item.matchPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
}
