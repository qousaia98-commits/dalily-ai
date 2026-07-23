"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  suggestRequestImprovements,
  type RequestOptimizerSuggestion,
} from "@/lib/search/smart-match/request-optimizer";
import { cn } from "@/lib/utils";

type Props = {
  description: string;
  hasPhotos: boolean;
  hasPreferredDate: boolean;
  hasPreferredTime: boolean;
  hasLocation: boolean;
  problemId?: string | null;
  className?: string;
};

export function RequestOptimizerHints({
  description,
  hasPhotos,
  hasPreferredDate,
  hasPreferredTime,
  hasLocation,
  problemId,
  className,
}: Props) {
  const t = useTranslations("serviceRequest.optimizer");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const suggestions = useMemo(() => {
    const all = suggestRequestImprovements({
      description,
      hasPhotos,
      hasPreferredDate,
      hasPreferredTime,
      hasLocation,
      problemId,
    });
    return all.filter((s) => !dismissed.has(s.id));
  }, [
    description,
    hasPhotos,
    hasPreferredDate,
    hasPreferredTime,
    hasLocation,
    problemId,
    dismissed,
  ]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--dalily-gold)]/25 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))] px-3 py-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
        <Lightbulb className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
        {t("title")}
      </div>
      <ul className="space-y-1.5">
        {suggestions.map((s: RequestOptimizerSuggestion) => (
          <li
            key={s.id}
            className="flex items-start justify-between gap-2 text-xs text-muted-foreground"
          >
            <span>{t(s.messageKey)}</span>
            <button
              type="button"
              className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80 hover:text-foreground"
              onClick={() => setDismissed((prev) => new Set(prev).add(s.id))}
            >
              {t("dismiss")}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">{t("optional")}</p>
    </div>
  );
}
