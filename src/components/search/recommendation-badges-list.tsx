"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RecommendationBadge } from "@/lib/dalily-ranking/types";
import { cn } from "@/lib/utils";

export function RecommendationBadgesList({
  badges,
  className,
}: {
  badges: RecommendationBadge[];
  className?: string;
}) {
  const t = useTranslations("search.recommendationBadges");
  if (!badges.length) return null;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={t("label")}>
      {badges.slice(0, 3).map((badge) => (
        <li key={badge.id}>
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,var(--card))] px-2.5 text-xs font-medium text-foreground">
            <Sparkles className="size-3 text-[var(--dalily-gold)]" aria-hidden />
            {t(badge.id)}
          </span>
        </li>
      ))}
    </ul>
  );
}
