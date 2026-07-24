"use client";

import { Link } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { CalendarClock, Inbox, MessageCircle, Bell } from "lucide-react";
import type { DashboardKpis } from "@/lib/provider-success/types";
import { cn } from "@/lib/utils";

const items = [
  {
    key: "todayAppointments" as const,
    icon: CalendarClock,
    href: "/business/calendar",
  },
  {
    key: "pendingBookingRequests" as const,
    icon: Inbox,
    href: "/business/bookings",
  },
  {
    key: "unreadMessages" as const,
    icon: MessageCircle,
    href: "/business/messages",
  },
] as const;

type Props = {
  kpis: DashboardKpis;
  unreadNotifications: number;
};

export function TodayOverviewStrip({ kpis, unreadNotifications }: Props) {
  const t = useTranslations("business.success.kpis");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ key, icon: Icon, href }) => {
        const value = kpis[key];
        const emphasize = typeof value === "number" && value > 0;
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "rounded-2xl border bg-card p-4 shadow-sm transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
              emphasize
                ? "border-[var(--dalily-gold)]/45 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]"
                : "border-border",
            )}
          >
            <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
              <Icon className="size-4 shrink-0" aria-hidden />
              <p className="truncate text-xs font-medium text-muted-foreground">{t(key)}</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          </Link>
        );
      })}
      <Link
        href="/business/messages"
        className={cn(
          "rounded-2xl border bg-card p-4 shadow-sm transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
          unreadNotifications > 0
            ? "border-[var(--dalily-gold)]/45 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]"
            : "border-border",
        )}
      >
        <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
          <Bell className="size-4 shrink-0" aria-hidden />
          <p className="truncate text-xs font-medium text-muted-foreground">
            {t("urgentNotifications")}
          </p>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">{unreadNotifications}</p>
      </Link>
    </div>
  );
}
