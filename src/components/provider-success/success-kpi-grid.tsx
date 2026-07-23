"use client";

import { Link } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  Inbox,
  MessageCircle,
  Star,
  CheckCircle2,
  Timer,
  Percent,
  Ban,
  CircleGauge,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { DashboardKpis } from "@/lib/provider-success/types";
import { cn } from "@/lib/utils";

const cards: Array<{
  key: keyof DashboardKpis;
  icon: typeof Star;
  href: string;
  format?: "percent" | "rating" | "hours" | "status";
}> = [
  { key: "todayAppointments", icon: CalendarClock, href: "/business/calendar" },
  { key: "upcomingBookings", icon: CalendarClock, href: "/business/bookings" },
  { key: "pendingBookingRequests", icon: Inbox, href: "/business/bookings" },
  { key: "unreadMessages", icon: MessageCircle, href: "/business/messages" },
  { key: "averageRating", icon: Star, href: "/business/analytics", format: "rating" },
  { key: "completedJobs", icon: CheckCircle2, href: "/business/bookings" },
  { key: "responseTimeHours", icon: Timer, href: "/business/messages", format: "hours" },
  { key: "acceptanceRate", icon: Percent, href: "/business/analytics", format: "percent" },
  { key: "cancellationRate", icon: Ban, href: "/business/analytics", format: "percent" },
  { key: "profileCompletion", icon: CircleGauge, href: "/business/profile", format: "percent" },
  { key: "verificationStatus", icon: ShieldCheck, href: "/business/verification", format: "status" },
  { key: "dalilyScore", icon: Trophy, href: "/business/analytics" },
];

function formatValue(
  key: keyof DashboardKpis,
  value: DashboardKpis[keyof DashboardKpis],
  format: (typeof cards)[number]["format"],
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (value == null) return "—";
  if (format === "percent") return `${value}%`;
  if (format === "rating") return Number(value).toFixed(1);
  if (format === "hours") return t("hoursValue", { hours: Number(value) });
  if (format === "status") return t(`verification.${String(value)}`);
  return String(value);
}

export function SuccessKpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const t = useTranslations("business.success.kpis");

  return (
    <section className="space-y-3" aria-labelledby="success-kpis-title">
      <h2 id="success-kpis-title" className="text-lg font-bold tracking-tight">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map(({ key, icon: Icon, href, format }) => {
          const emphasize =
            (key === "pendingBookingRequests" && kpis.pendingBookingRequests > 0) ||
            (key === "unreadMessages" && kpis.unreadMessages > 0);
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "rounded-2xl border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
                "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                emphasize
                  ? "border-[var(--dalily-gold)]/45 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]"
                  : "border-border",
              )}
            >
              <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
                <Icon className="size-4 shrink-0" aria-hidden />
                <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(key)}
                </p>
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                {formatValue(key, kpis[key], format, t)}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
