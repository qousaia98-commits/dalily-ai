import { getTranslations } from "next-intl/server";
import type { RatingDistribution } from "@/lib/reviews/trust-score";
import { cn } from "@/lib/utils";

type Props = {
  distribution: RatingDistribution;
  ratingAvg: number;
  reviewCount: number;
};

export async function RatingBreakdown({ distribution, ratingAvg, reviewCount }: Props) {
  const t = await getTranslations("reviews");
  const total = distribution.total || reviewCount || 1;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4">
      <div className="mb-4 flex items-end gap-3">
        <p className="text-4xl font-bold tabular-nums text-[var(--dalily-navy)]">
          {ratingAvg.toFixed(1)}
        </p>
        <div className="pb-1">
          <p className="text-sm font-medium text-foreground">{t("averageLabel")}</p>
          <p className="text-xs text-muted-foreground">
            {t("basedOn", { count: reviewCount })}
          </p>
        </div>
      </div>
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
