"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CustomerDemandHint } from "@/domains/forecast/client";

type Props = { hint: CustomerDemandHint };

/**
 * Customer-facing demand hint — advisory only, no internal math.
 */
export function CustomerDemandHintCard({ hint }: Props) {
  const t = useTranslations("forecast.customer");
  const locale = useLocale();

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <p className="text-sm font-medium">
        {t(`demand.${hint.demandLevel}`)} · {t(`availability.${hint.estimatedAvailability}`)}
      </p>

      {hint.bookEarly ? (
        <p className="text-sm text-muted-foreground">{t("bookEarly")}</p>
      ) : null}
      {hint.fasterAvailability ? (
        <p className="text-sm text-muted-foreground">{t("faster")}</p>
      ) : null}

      <ul className="list-disc space-y-1 ps-5 text-sm">
        {hint.explanations.map((e) => (
          <li key={e.code}>
            {locale === "ar" && e.labelAr ? e.labelAr : e.labelEn}
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">{t("advisory")}</p>
    </section>
  );
}
