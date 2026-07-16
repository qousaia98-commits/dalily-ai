import type { LucideIcon } from "lucide-react";

export type MobileNavRole = "guest" | "business" | "admin";

export type MobileNavBadgeKey = "approvals" | "payments" | "messages" | "notifications";

export type MobileNavBadges = Partial<Record<MobileNavBadgeKey, number>>;

export type MobileNavItemConfig = {
  id: string;
  href: string;
  icon: LucideIcon;
  /** i18n key under `mobileNav.{role}` */
  labelKey: string;
  /** Match pathname exactly (for home/dashboard roots) */
  exact?: boolean;
  /** Additional path prefixes that keep this tab active */
  matchPrefixes?: readonly string[];
  badgeKey?: MobileNavBadgeKey;
};
