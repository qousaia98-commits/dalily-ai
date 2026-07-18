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
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type AdminSidebarProps = {
  badges?: {
    businesses?: number;
    payments?: number;
    messages?: number;
  };
};

const navItems = [
  { href: "/admin", icon: LayoutDashboard, key: "dashboard", exact: true },
  { href: "/admin/providers", icon: Building2, key: "businesses", badgeKey: "businesses" as const },
  { href: "/admin/payments", icon: Banknote, key: "payments", badgeKey: "payments" as const },
  { href: "/admin/subscriptions", icon: CreditCard, key: "subscriptions" },
  { href: "/admin/marketplace", icon: Megaphone, key: "marketplace" },
  { href: "/admin/verification", icon: ShieldCheck, key: "verification" },
  { href: "/admin/categories", icon: Tags, key: "categories" },
  { href: "/admin/searches", icon: Search, key: "searches" },
  { href: "/admin/users", icon: Users, key: "users" },
] as const;

export function AdminSidebar({ badges = {} }: AdminSidebarProps) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <nav className="flex flex-col gap-1">
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
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold",
                  active
                    ? "bg-[var(--dalily-gold)] text-[var(--dalily-navy)]"
                    : "bg-[var(--dalily-gold)] text-[var(--dalily-navy)]",
                )}
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
        <div className="sticky top-20 rounded-xl border bg-card p-4">
          <p className="mb-4 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("title")}
          </p>
          <NavContent />
        </div>
      </aside>
    </>
  );
}
