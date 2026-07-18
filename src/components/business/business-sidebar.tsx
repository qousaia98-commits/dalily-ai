"use client";

import {
  LayoutDashboard,
  User,
  Wrench,
  Images,
  BarChart3,
  ShieldCheck,
  Star,
  Menu,
  MessageCircle,
  Inbox,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/shared/plan-badge";
import { useState } from "react";
import type { PlanSlug } from "@/lib/subscription/types";

const navItems = [
  { href: "/business", icon: LayoutDashboard, key: "dashboard", exact: true },
  { href: "/business/requests", icon: Inbox, key: "requests", badgeKey: "requests" as const },
  { href: "/business/messages", icon: MessageCircle, key: "messages", badgeKey: "messages" as const },
  { href: "/business/profile", icon: User, key: "profile" },
  { href: "/business/services", icon: Wrench, key: "services" },
  { href: "/business/gallery", icon: Images, key: "gallery" },
  { href: "/business/analytics", icon: BarChart3, key: "analytics" },
  { href: "/business/verification", icon: ShieldCheck, key: "verification" },
  { href: "/business/settings", icon: Settings, key: "settings" },
  { href: "/business/subscription", icon: Star, key: "upgrade" },
] as const;

type BusinessSidebarProps = {
  planSlug?: PlanSlug | string;
  businessName?: string | null;
  badges?: { messages?: number; requests?: number };
};

export function BusinessSidebar({
  planSlug = "free",
  businessName,
  badges = {},
}: BusinessSidebarProps) {
  const t = useTranslations("business.nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <nav className="flex flex-col gap-1" aria-label={t("title")}>
      {businessName ? (
        <div className="mb-3 space-y-2 rounded-2xl border border-border bg-muted/40 px-3 py-3">
          <p className="truncate text-sm font-bold text-foreground">{businessName}</p>
          <PlanBadge planSlug={planSlug} />
        </div>
      ) : null}
      {navItems.map((item) => {
        const { href, icon: Icon, key } = item;
        const exact = "exact" in item && item.exact;
        const badgeKey = "badgeKey" in item ? item.badgeKey : undefined;
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
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{t(key)}</span>
            {badgeCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--dalily-navy)]">
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
