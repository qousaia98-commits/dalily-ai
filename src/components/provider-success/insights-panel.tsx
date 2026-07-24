"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import type { ProviderInsight } from "@/lib/provider-success/types";

export function InsightsPanel({
  insights,
  hideHeader = false,
}: {
  insights: ProviderInsight[];
  hideHeader?: boolean;
}) {
  const t = useTranslations("business.success.insights");

  return (
    <section className="space-y-3" aria-labelledby={hideHeader ? undefined : "insights-title"}>
      {!hideHeader ? (
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-[var(--dalily-gold)]" aria-hidden />
          <div>
            <h2 id="insights-title" className="text-lg font-bold tracking-tight">
              {t("title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
      ) : null}
      {insights.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="space-y-2">
          {insights.map((insight, idx) => (
            <li key={insight.id}>
              <Link
                href={insight.href}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-[var(--dalily-gold)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              >
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--dalily-gold)]/15 text-xs font-bold text-[var(--dalily-navy)] dark:text-[var(--dalily-gold)]">
                    {idx + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t(`items.${insight.id}`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("impact", { value: insight.impact })}
                    </span>
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
