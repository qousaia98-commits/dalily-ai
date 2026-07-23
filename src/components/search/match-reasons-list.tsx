"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MatchReason } from "@/lib/search/smart-match/reasons";
import { cn } from "@/lib/utils";

type Props = {
  reasons: MatchReason[];
  className?: string;
};

export function MatchReasonsList({ reasons, className }: Props) {
  const t = useTranslations("search.matchReasons");
  if (!reasons.length) return null;

  return (
    <ul className={cn("space-y-1.5 text-sm text-muted-foreground", className)}>
      {reasons.map((reason) => (
        <li key={reason.id} className="flex items-start gap-2">
          <CheckCircle2
            className="mt-0.5 size-3.5 shrink-0 text-[var(--dalily-gold)]"
            aria-hidden
          />
          <span>
            {t(reason.id, reason.params as Record<string, string | number> | undefined)}
          </span>
        </li>
      ))}
    </ul>
  );
}
