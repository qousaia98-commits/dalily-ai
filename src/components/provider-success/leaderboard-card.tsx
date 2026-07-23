"use client";

import { useTranslations } from "next-intl";
import { Trophy, Star, CheckCircle2, Medal } from "lucide-react";
import type { Achievement, ProviderLevel } from "@/lib/provider-success/types";
import { Progress } from "@/components/ui/progress";

export function LeaderboardCard({
  level,
  dalilyScore,
  averageRating,
  completedJobs,
  badges,
}: {
  level: ProviderLevel;
  dalilyScore: number;
  averageRating: number;
  completedJobs: number;
  badges: string[];
}) {
  const t = useTranslations("business.success.leaderboard");

  return (
    <section
      className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      aria-labelledby="leaderboard-title"
    >
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-[var(--dalily-gold)]" aria-hidden />
        <h2 id="leaderboard-title" className="text-lg font-bold tracking-tight">
          {t("title")}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("dalilyScore")}</p>
          <p className="text-2xl font-bold">{dalilyScore}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("rating")}</p>
          <p className="flex items-center gap-1 text-2xl font-bold">
            <Star className="size-4 text-[var(--dalily-gold)]" aria-hidden />
            {averageRating.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("jobs")}</p>
          <p className="flex items-center gap-1 text-2xl font-bold">
            <CheckCircle2 className="size-4" aria-hidden />
            {completedJobs}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("level")}</p>
          <p className="text-2xl font-bold">{t(level.titleKey)}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t("progressToNext")}</span>
          <span>
            {level.currentScore}/{level.nextLevelAt}
          </span>
        </div>
        <Progress value={level.progressPercent} aria-label={t("progressAria")} />
      </div>
      {badges.length ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-muted/40 px-3 text-xs font-medium"
            >
              <Medal className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
              {t(`badges.${b}`)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function AchievementsPanel({ achievements }: { achievements: Achievement[] }) {
  const t = useTranslations("business.success.achievements");

  return (
    <section className="space-y-3" aria-labelledby="achievements-title">
      <h2 id="achievements-title" className="text-lg font-bold tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {achievements.map((a) => (
          <li
            key={a.id}
            className={`rounded-2xl border px-3 py-3 ${
              a.unlocked
                ? "border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))]"
                : "border-border bg-card opacity-80"
            }`}
          >
            <p className="text-sm font-semibold">{t(`items.${a.id}`)}</p>
            <Progress value={a.progress} className="mt-2" aria-label={t(`items.${a.id}`)} />
            <p className="mt-1 text-xs text-muted-foreground">
              {a.unlocked ? t("unlocked") : t("progress", { value: a.progress })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
