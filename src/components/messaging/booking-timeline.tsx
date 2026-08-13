"use client";

import { useTranslations } from "next-intl";
import { Check, Circle } from "lucide-react";
import type { CommunicationTimelineItem } from "@/domains/chat/communication";
import { cn } from "@/lib/utils";

export function BookingTimeline({
  items,
}: {
  items: CommunicationTimelineItem[];
}) {
  const t = useTranslations("messaging.timeline");
  if (!items.length) return null;

  return (
    <nav
      className="border-b border-border/70 bg-muted/20 px-3 py-3"
      aria-label={t("aria")}
    >
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {items.map((item, idx) => (
          <li
            key={item.step}
            className={cn(
              "flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 text-center",
              item.status === "done" && "text-emerald-700 dark:text-emerald-400",
              item.status === "current" && "text-foreground font-semibold",
              item.status === "upcoming" && "text-muted-foreground",
              item.status === "skipped" && "text-muted-foreground/60",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-[10px]",
                item.status === "done" &&
                  "border-emerald-500/50 bg-emerald-500/15",
                item.status === "current" &&
                  "border-[var(--dalily-gold)] bg-[var(--dalily-gold)]/15",
                item.status === "upcoming" && "border-border bg-background",
              )}
              aria-hidden
            >
              {item.status === "done" ? (
                <Check className="size-3.5" />
              ) : (
                <Circle className="size-2.5 fill-current" />
              )}
            </span>
            <span className="text-[10px] leading-tight">{t(item.step)}</span>
            {idx < items.length - 1 ? (
              <span className="sr-only">→</span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
