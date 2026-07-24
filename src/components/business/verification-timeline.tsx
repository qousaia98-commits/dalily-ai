"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { VerificationTimelineEvent } from "@/lib/verification/status";

type Props = {
  events: VerificationTimelineEvent[];
  className?: string;
};

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Verification history timeline — derived from existing provider/verification timestamps.
 */
export function VerificationTimeline({ events, className }: Props) {
  const t = useTranslations("business.verification.timeline");
  const locale = useLocale();

  if (events.length === 0) return null;

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}
      aria-labelledby="verification-timeline-title"
    >
      <h2 id="verification-timeline-title" className="text-lg font-bold tracking-tight">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      <ol className="relative mt-6 space-y-0 border-s border-border ms-3 ps-6">
        {events.map((event, index) => (
          <li key={`${event.id}-${index}`} className="relative pb-6 last:pb-0">
            <span
              className={cn(
                "absolute -start-[1.6rem] top-1 size-3 rounded-full border-2 border-background",
                event.current ? "bg-[var(--dalily-gold)]" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <p
              className={cn(
                "text-sm font-semibold",
                event.current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(`events.${event.id}`)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(event.at, locale)}
            </p>
            {event.note ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground">
                {event.note}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
