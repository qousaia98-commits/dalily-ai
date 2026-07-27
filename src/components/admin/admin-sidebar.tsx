"use client";

import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Users,
  Menu,
  Banknote,
  AlertTriangle,
  MessageCircle,
  KeyRound,
  Activity,
  ScrollText,
  Settings,
  BarChart3,
  Megaphone,
  Tags,
  ChevronDown,
  Brain,
  Bot,
  Siren,
  FolderKanban,
  RefreshCw,
  RotateCcw,
  LineChart,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAdminBadges } from "@/components/admin/admin-badges-provider";
import type { AdminBadgeChannel } from "@/lib/admin/badge-ack";
import { getActiveNavigationItem } from "@/lib/navigation/active-item";
import { NavCountBadge } from "@/components/shared/nav-count-badge";

type AdminSidebarProps = {
  showAdminOnly?: boolean;
  marketplaceOps?: boolean;
};

type NavItem = {
  id: string;
  href: string;
  icon: typeof LayoutDashboard;
  key: string;
  exact?: boolean;
  badgeKey?: AdminBadgeChannel;
  matchPrefixes?: readonly string[];
  /** Visible only when showAdminOnly */
  adminOnly?: boolean;
  /** Visible only when marketplaceOps */
  opsOnly?: boolean;
};

type NavGroup = {
  id: string;
  labelKey: string;
  items: NavItem[];
};

const HOME: NavItem = {
  id: "dashboard",
  href: "/admin",
  icon: LayoutDashboard,
  key: "dashboard",
  exact: true,
};

function buildGroups(opts: {
  showAdminOnly: boolean;
  marketplaceOps: boolean;
}): NavGroup[] {
  const people: NavItem[] = [
    {
      id: "businesses",
      href: "/admin/providers",
      icon: Building2,
      key: "businesses",
      badgeKey: "businesses",
    },
    { id: "customers", href: "/admin/users", icon: Users, key: "customers" },
    {
      id: "verification",
      href: "/admin/verification",
      icon: ShieldCheck,
      key: "verification",
      badgeKey: "verification",
    },
  ];

  const operations: NavItem[] = [
    {
      id: "payments",
      href: "/admin/payments",
      icon: Banknote,
      key: "payments",
      badgeKey: "payments",
      adminOnly: true,
    },
    {
      id: "refunds",
      href: "/admin/refunds",
      icon: RotateCcw,
      key: "refunds",
      adminOnly: true,
    },
    {
      id: "finance",
      href: "/admin/finance",
      icon: LineChart,
      key: "finance",
      adminOnly: true,
    },
    {
      id: "reviews",
      href: "/admin/reviews",
      icon: MessageCircle,
      key: "reviewModeration",
      adminOnly: true,
    },
    {
      id: "reputation",
      href: "/admin/reputation",
      icon: ShieldCheck,
      key: "reputation",
      adminOnly: true,
    },
    {
      id: "issues",
      href: "/admin/issues",
      icon: AlertTriangle,
      key: "issues",
      badgeKey: "issues",
    },
    {
      id: "quality",
      href: "/admin/quality",
      icon: ShieldCheck,
      key: "quality",
      adminOnly: true,
    },
    {
      id: "fraud",
      href: "/admin/fraud",
      icon: Siren,
      key: "fraud",
      adminOnly: true,
    },
    {
      id: "aiOps",
      href: "/admin/ai-ops",
      icon: Brain,
      key: "aiOps",
      adminOnly: true,
    },
    {
      id: "messages",
      href: "/admin/messages",
      icon: MessageCircle,
      key: "messages",
      badgeKey: "messages",
    },
    {
      id: "unlockOps",
      href: "/admin/unlock-ops",
      icon: KeyRound,
      key: "unlockOps",
      adminOnly: true,
      opsOnly: true,
    },
  ];

  const system: NavItem[] = [
    { id: "settings", href: "/admin/settings", icon: Settings, key: "settings" },
    {
      id: "audit",
      href: "/admin/audit",
      icon: ScrollText,
      key: "audit",
      badgeKey: "audit",
    },
    { id: "health", href: "/admin/health", icon: Activity, key: "health" },
    {
      id: "categories",
      href: "/admin/categories",
      icon: Tags,
      key: "categories",
      adminOnly: true,
    },
  ];

  const more: NavItem[] = [
    {
      id: "analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      key: "analytics",
    },
    {
      id: "ai-predictions",
      href: "/admin/ai-predictions",
      icon: Brain,
      key: "aiPredictions",
      adminOnly: true,
    },
    {
      id: "ai-automation",
      href: "/admin/ai-automation",
      icon: Bot,
      key: "aiAutomation",
      adminOnly: true,
    },
    {
      id: "emergency",
      href: "/admin/emergency",
      icon: Siren,
      key: "emergency",
      adminOnly: true,
    },
    {
      id: "projects",
      href: "/admin/projects",
      icon: FolderKanban,
      key: "projects",
      adminOnly: true,
    },
    {
      id: "recurring",
      href: "/admin/recurring",
      icon: RefreshCw,
      key: "recurring",
      adminOnly: true,
    },
    {
      id: "marketplace",
      href: "/admin/marketplace",
      icon: Megaphone,
      key: "marketplace",
      adminOnly: true,
    },
  ];

  const filter = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.adminOnly && !opts.showAdminOnly) return false;
      if (item.opsOnly && !opts.marketplaceOps) return false;
      return true;
    });

  return [
    { id: "people", labelKey: "groups.people", items: filter(people) },
    { id: "operations", labelKey: "groups.operations", items: filter(operations) },
    { id: "system", labelKey: "groups.system", items: filter(system) },
    { id: "more", labelKey: "groups.more", items: filter(more) },
  ].filter((g) => g.items.length > 0);
}

export function AdminSidebar({
  showAdminOnly = true,
  marketplaceOps = false,
}: AdminSidebarProps) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { badges } = useAdminBadges();

  const groups = useMemo(
    () => buildGroups({ showAdminOnly, marketplaceOps }),
    [showAdminOnly, marketplaceOps],
  );

  const flatItems = useMemo(() => {
    const items: NavItem[] = [HOME];
    for (const g of groups) items.push(...g.items);
    return items;
  }, [groups]);

  const activeItem = getActiveNavigationItem(pathname, flatItems);
  const moreGroup = groups.find((g) => g.id === "more");
  const activeInMore = Boolean(
    moreGroup?.items.some((item) => item.id === activeItem.id),
  );
  const moreExpanded = moreOpen || activeInMore;

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeItem.id === item.id;
    const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{t(item.key)}</span>
        <NavCountBadge count={badgeCount} />
      </Link>
    );
  };

  const NavContent = () => (
    <nav className="flex flex-col gap-5" aria-label={t("menu")}>
      <div className="space-y-1">{renderLink(HOME)}</div>

      {groups.map((group) => {
        if (group.id === "more") {
          return (
            <div key={group.id} className="space-y-1">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
                )}
                aria-expanded={moreExpanded}
              >
                {t(group.labelKey)}
                <ChevronDown
                  className={cn("size-4 transition-transform", moreExpanded && "rotate-180")}
                  aria-hidden
                />
              </button>
              {moreExpanded ? (
                <div className="space-y-1">{group.items.map(renderLink)}</div>
              ) : null}
            </div>
          );
        }

        return (
          <div key={group.id} className="space-y-1">
            <p className="px-3 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {t(group.labelKey)}
            </p>
            {group.items.map(renderLink)}
          </div>
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
          className="min-h-11 gap-2"
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
