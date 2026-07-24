"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import type { ActivityItem } from "@/lib/provider-success/types";
import { formatDateTime } from "@/lib/format/datetime";

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const t = useTranslations("business.success.activity");
  const locale = useLocale();

  return (
    <section className="space-y-3" aria-labelledby="activity-title">
      <h2 id="activity-title" className="text-lg font-bold tracking-tight">
        {t("title")}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="relative space-y-3 border-s border-border ps-4">
          {items.map((item) => {
            const when = formatDateTime(item.at, locale === "ar" ? "ar" : "en", {
              dateStyle: "medium",
              timeStyle: "short",
            });
            const content = (
              <div className="rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
                <p className="text-sm font-semibold">{t(`kinds.${item.kind}`)}</p>
                <p className="text-xs text-muted-foreground">{when}</p>
              </div>
            );
            return (
              <li key={item.id} className="relative">
                <span
                  className="absolute -start-[1.3rem] top-3 size-2.5 rounded-full bg-[var(--dalily-gold)]"
                  aria-hidden
                />
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
