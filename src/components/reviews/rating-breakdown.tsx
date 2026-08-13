import { getTranslations } from "next-intl/server";
import type { RatingDistribution } from "@/lib/reviews/trust-score";
import { cn } from "@/lib/utils";

type Props = {
  distribution: RatingDistribution;
  ratingAvg: number;
  reviewCount: number;
  recommendationRate?: number | null;
  qualityLabel?: string | null;
  aiSummary?: string | null;
};

export async function RatingBreakdown({
  distribution,
  ratingAvg,
  reviewCount,
  recommendationRate,
  qualityLabel,
  aiSummary,
}: Props) {
  const t = await getTranslations("reviews");
  const total = distribution.total || reviewCount || 1;
  const stars = "★".repeat(Math.round(Math.min(5, Math.max(0, ratingAvg))));

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-sm tracking-wide text-amber-500" aria-hidden>
            {stars}
            <span className="ms-2 text-4xl font-bold tabular-nums text-[var(--dalily-navy)]">
              {ratingAvg.toFixed(1)}
            </span>
          </p>
          {qualityLabel ? (
            <p className="mt-1 text-base font-semibold text-foreground">
              {t(`quality.${qualityLabelKey(qualityLabel)}` as "quality.excellent")}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-foreground">{t("averageLabel")}</p>
          )}
          {recommendationRate != null ? (
            <p className="text-sm text-muted-foreground">
              {t("recommendedBy", { pct: Math.round(recommendationRate) })}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("basedOnVerified", { count: reviewCount })}
          </p>
        </div>
      </div>

      {aiSummary ? (
        <blockquote className="border-s-2 border-[var(--dalily-gold)] ps-3 text-sm leading-relaxed text-foreground/90">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("aiSummaryLabel")}
          </p>
          <p className="mt-1">“{aiSummary}”</p>
        </blockquote>
      ) : null}

      <ul className="space-y-2" aria-label={t("breakdownLabel")}>
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[star];
          const pct = Math.round((count / total) * 100);
          return (
            <li key={star} className="flex items-center gap-2 text-sm">
              <span className="w-8 tabular-nums text-muted-foreground">{star}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full bg-amber-400 transition-[width]")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-end tabular-nums text-xs text-muted-foreground">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function qualityLabelKey(label: string): string {
  const map: Record<string, string> = {
    Excellent: "excellent",
    "Very good": "veryGood",
    Good: "good",
    Fair: "fair",
    "Needs improvement": "needsImprovement",
  };
  return map[label] ?? "good";
}
