"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PublicPriceRecommendation } from "@/lib/pricing-engine/types";

type Props = {
  recommendation: PublicPriceRecommendation;
  /** Optional customer budget hint (never compared to provider internals). */
  budgetHint?: "under" | "within" | "over" | null;
};

function money(n: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", {
      style: "currency",
      currency: currency === "SYP" ? "SYP" : currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/**
 * Customer-facing fair market estimate — no provider internal data.
 */
export function CustomerFairMarketEstimate({
  recommendation,
  budgetHint = null,
}: Props) {
  const t = useTranslations("pricing.customer");
  const locale = useLocale();

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <p className="text-lg font-semibold tabular-nums">
        {money(recommendation.suggestedMin, recommendation.currency, locale)} –{" "}
        {money(recommendation.suggestedPremium, recommendation.currency, locale)}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("fairAverage")}:{" "}
        {money(recommendation.suggestedAvg, recommendation.currency, locale)} ·{" "}
        {t(`position.${recommendation.marketPosition}`)}
      </p>

      <ul className="list-disc space-y-1 ps-5 text-sm">
        {recommendation.explanations.map((e) => (
          <li key={e.code}>
            {locale === "ar" && e.labelAr ? e.labelAr : e.labelEn}
          </li>
        ))}
      </ul>

      {budgetHint ? (
        <p className="text-xs text-muted-foreground">{t(`budget.${budgetHint}`)}</p>
      ) : null}

      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </section>
  );
}
