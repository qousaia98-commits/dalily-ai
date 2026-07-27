"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CustomerScheduleHint } from "@/lib/scheduling-engine/types";

type Props = { hint: CustomerScheduleHint };

export function CustomerScheduleHintCard({ hint }: Props) {
  const t = useTranslations("scheduling.customer");
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
        {t(`availability.${hint.availabilityForecast}`)} · {t("confidence")}:{" "}
        {Math.round(hint.bookingConfidence * 100)}%
      </p>
      {hint.arrivalWindow ? (
        <p className="text-sm text-muted-foreground">
          {t("arrival")}: {hint.arrivalWindow}
        </p>
      ) : null}
      <ul className="list-disc space-y-1 ps-5 text-sm">
        {hint.availableWindows.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
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
