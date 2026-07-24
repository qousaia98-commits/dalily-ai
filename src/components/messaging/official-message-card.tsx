"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import type { DalilyMessageCategory, DalilyRichContent } from "@/lib/dalily-messages/message-meta";
import { Button } from "@/components/ui/button";

const CATEGORY_I18N: Record<DalilyMessageCategory, string> = {
  announcement: "categories.announcement",
  security: "categories.security",
  feature: "categories.feature",
  billing: "categories.billing",
  maintenance: "categories.maintenance",
  verification: "categories.verification",
};

const STATUS_TONE: Record<NonNullable<DalilyRichContent["statusTone"]>, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  info: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  neutral: "bg-muted text-muted-foreground",
};

export function OfficialMessageCard({
  body,
  category,
  rich,
  timeLabel,
  createdAt,
  namespace = "business.messages",
  senderLabel,
}: {
  body: string;
  category?: DalilyMessageCategory | null;
  rich?: DalilyRichContent | null;
  timeLabel?: string | null;
  createdAt?: string;
  namespace?: string;
  senderLabel: string;
}) {
  const t = useTranslations(namespace);
  const showCard = Boolean(rich?.cardTitle || rich?.cardBody);

  return (
    <div className="flex justify-start">
      <article
        className={cn(
          "max-w-[90%] overflow-hidden rounded-2xl rounded-es-md border border-[var(--dalily-gold)]/30",
          "bg-[color-mix(in_oklab,var(--dalily-gold)_7%,var(--card))] text-foreground shadow-sm sm:max-w-[75%]",
        )}
      >
        {rich?.banner ? (
          <div className="border-b border-[var(--dalily-gold)]/20 bg-[var(--dalily-navy)] px-3.5 py-2">
            <p className="text-xs font-semibold tracking-wide text-[var(--dalily-gold)]">
              {rich.banner}
            </p>
          </div>
        ) : null}

        <div className="space-y-2 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--dalily-gold)]">
              {senderLabel}
            </p>
            {category ? (
              <span className="rounded-full bg-[var(--dalily-navy)]/90 px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--dalily-gold)]">
                {t(CATEGORY_I18N[category])}
              </span>
            ) : null}
            {rich?.statusChip ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold",
                  STATUS_TONE[rich.statusTone ?? "neutral"],
                )}
              >
                {rich.statusChip}
              </span>
            ) : null}
          </div>

          {showCard ? (
            <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2.5">
              {rich?.cardTitle ? (
                <p className="text-sm font-bold tracking-tight">{rich.cardTitle}</p>
              ) : null}
              {rich?.cardBody ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {rich.cardBody}
                </p>
              ) : null}
            </div>
          ) : null}

          {body ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p> : null}

          {rich?.cta?.href ? (
            <Button asChild size="sm" className="mt-1 min-h-9 rounded-xl">
              <Link href={rich.cta.href}>
                {rich.cta.labelKey
                  ? t(rich.cta.labelKey)
                  : (rich.cta.label ?? t("richCtaDefault"))}
              </Link>
            </Button>
          ) : null}

          {timeLabel && createdAt ? (
            <time className="block text-[0.65rem] text-muted-foreground" dateTime={createdAt}>
              {timeLabel}
            </time>
          ) : null}
        </div>
      </article>
    </div>
  );
}
