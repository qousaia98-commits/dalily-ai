"use client";

import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import type { DalilyScoreBreakdown } from "@/lib/dalily-ranking/types";
import { DALILY_SCORE_COMPONENT_KEYS } from "@/lib/dalily-ranking/weights";
import { Progress } from "@/components/ui/progress";
import { DEFAULT_DALILY_WEIGHTS } from "@/lib/dalily-ranking/weights";

export function DalilyScoreBreakdownCard({
  breakdown,
  tips,
  rankingPosition,
}: {
  breakdown: DalilyScoreBreakdown;
  tips: Array<{ component: string; tipKey: string }>;
  rankingPosition?: number | null;
}) {
  const t = useTranslations("business.success.dalilyRanking");

  return (
    <section
      className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      aria-labelledby="dalily-score-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-[var(--dalily-gold)]" aria-hidden />
          <div>
            <h2 id="dalily-score-title" className="text-lg font-bold tracking-tight">
              {t("title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-3xl font-bold">{breakdown.overall}</p>
          <p className="text-xs text-muted-foreground">{t("overall")}</p>
          {rankingPosition != null ? (
            <p className="mt-1 text-xs font-medium">{t("position", { n: rankingPosition })}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["quality", "trust", "reliability"] as const).map((key) => (
          <div key={key} className="rounded-2xl border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`components.${key}`)}
            </p>
            <p className="mt-1 text-xl font-bold">
              {Math.round(breakdown.components[key] * 100)}
            </p>
            <Progress value={breakdown.components[key] * 100} className="mt-2" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("allComponents")}</p>
        <ul className="space-y-2">
          {DALILY_SCORE_COMPONENT_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">
                {t(`components.${key}`)}
              </span>
              <Progress
                value={breakdown.components[key] * 100}
                className="flex-1"
                aria-label={t(`components.${key}`)}
              />
              <span className="w-10 text-end text-xs font-medium">
                {Math.round(breakdown.components[key] * 100)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {tips.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("tipsTitle")}</p>
          <ul className="space-y-1.5">
            {tips.map((tip) => (
              <li
                key={tip.tipKey}
                className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                {t(`tips.${tip.tipKey}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[0.65rem] text-muted-foreground">
        {t("weightsNote", {
          distance: Math.round(DEFAULT_DALILY_WEIGHTS.distance * 100),
          quality: Math.round(DEFAULT_DALILY_WEIGHTS.quality * 100),
        })}
      </p>
    </section>
  );
}
