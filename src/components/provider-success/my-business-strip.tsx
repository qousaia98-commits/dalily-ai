"use client";

import { Link } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { Star, Trophy, ShieldCheck, CircleGauge } from "lucide-react";
import type { DashboardKpis } from "@/lib/provider-success/types";
import { cn } from "@/lib/utils";

type Props = { kpis: DashboardKpis };

export function MyBusinessStrip({ kpis }: Props) {
  const t = useTranslations("business.success.kpis");

  const cards = [
    {
      key: "averageRating",
      value: kpis.averageRating != null ? Number(kpis.averageRating).toFixed(1) : "—",
      icon: Star,
      href: "/business/analytics",
    },
    {
      key: "dalilyScore",
      value: String(kpis.dalilyScore ?? "—"),
      icon: Trophy,
      href: "/business/analytics",
    },
    {
      key: "verificationStatus",
      value: t(`verification.${String(kpis.verificationStatus)}`),
      icon: ShieldCheck,
      href: "/business/verification",
    },
    {
      key: "profileCompletion",
      value: `${kpis.profileCompletion}%`,
      icon: CircleGauge,
      href: "/business/profile",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ key, value, icon: Icon, href }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "rounded-2xl border border-border bg-card p-4 shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
          )}
        >
          <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
            <Icon className="size-4 shrink-0" aria-hidden />
            <p className="truncate text-xs font-medium text-muted-foreground">{t(key)}</p>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
        </Link>
      ))}
    </div>
  );
}
