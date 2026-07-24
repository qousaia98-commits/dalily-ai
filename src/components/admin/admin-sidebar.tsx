"use client";

import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Search,
  Users,
  Menu,
  CreditCard,
  Tags,
  Banknote,
  Megaphone,
  Brain,
  Gauge,
  AlertTriangle,
  MessageSquareWarning,
  Radio,
  Activity,
  ScrollText,
  BarChart3,
  FolderOpen,
  MessageCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAdminBadges } from "@/components/admin/admin-badges-provider";
import type { AdminBadgeChannel } from "@/lib/admin/badge-ack";

type AdminSidebarProps = {
  showAdminOnly?: boolean;
};

const sharedNav = [
  { href: "/admin", icon: LayoutDashboard, key: "dashboard", exact: true },
  { href: "/admin/providers", icon: Building2, key: "businesses", badgeKey: "businesses" as const },
  { href: "/admin/users", icon: Users, key: "customers" },
  {
    href: "/admin/verification",
    icon: ShieldCheck,
    key: "verification",
    badgeKey: "verification" as const,
  },
  { href: "/admin/issues", icon: AlertTriangle, key: "issues", badgeKey: "issues" as const },
  {
    href: "/admin/reviews",
    icon: MessageSquareWarning,
    key: "reviewModeration",
    badgeKey: "reviews" as const,
  },
  { href: "/admin/messages", icon: MessageCircle, key: "messages", badgeKey: "messages" as const },
  { href: "/admin/ranking", icon: Gauge, key: "ranking" },
  { href: "/admin/analytics", icon: BarChart3, key: "analytics" },
  { href: "/admin/searches", icon: Search, key: "searches" },
  { href: "/admin/content", icon: FolderOpen, key: "content" },
  { href: "/admin/health", icon: Activity, key: "health" },
  { href: "/admin/audit", icon: ScrollText, key: "audit", badgeKey: "audit" as const },
] as const;

const adminOnlyNav = [
  { href: "/admin/payments", icon: Banknote, key: "payments", badgeKey: "payments" as const },
  {
    href: "/admin/subscriptions",
    icon: CreditCard,
    key: "subscriptions",
    badgeKey: "subscriptions" as const,
  },
  { href: "/admin/marketplace", icon: Megaphone, key: "marketplace" },
  { href: "/admin/learning", icon: Brain, key: "learning" },
  {
    href: "/admin/broadcasts",
    icon: Radio,
    key: "broadcasts",
    badgeKey: "broadcasts" as const,
  },
  { href: "/admin/categories", icon: Tags, key: "categories" },
] as const;

export function AdminSidebar({ showAdminOnly = true }: AdminSidebarProps) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { badges } = useAdminBadges();

  const navItems = showAdminOnly ? [...sharedNav, ...adminOnlyNav] : [...sharedNav];

  const NavContent = () => (
    <nav className="flex flex-col gap-1" aria-label={t("menu")}>
      {navItems.map((item) => {
        const { href, icon: Icon, key } = item;
        const exact = "exact" in item && item.exact;
        const badgeKey = "badgeKey" in item ? (item.badgeKey as AdminBadgeChannel) : undefined;
        const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t(key)}</span>
            {badgeCount > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--dalily-navy)]"
                aria-label={`${badgeCount}`}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="mb-4 hidden md:block lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setMobileOpen(!mobileOpen)} className="gap-2">
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
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border bg-card p-4">
          <p className="mb-4 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("title")}
          </p>
          <NavContent />
        </div>
      </aside>
    </>
  );
}
