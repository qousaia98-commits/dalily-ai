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
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { href: "/business", icon: LayoutDashboard, key: "dashboard" },
  { href: "/business/profile", icon: User, key: "profile" },
  { href: "/business/services", icon: Wrench, key: "services" },
  { href: "/business/gallery", icon: Images, key: "gallery" },
  { href: "/business/analytics", icon: BarChart3, key: "analytics" },
  { href: "/business/verification", icon: ShieldCheck, key: "verification" },
  { href: "/business/subscription", icon: Star, key: "upgrade" },
] as const;

export function BusinessSidebar() {
  const t = useTranslations("business.nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, icon: Icon, key }) => {
        const active = pathname === href || (href !== "/business" && pathname.startsWith(href));
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
            {t(key)}
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
