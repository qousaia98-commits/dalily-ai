"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import type { ProfileMissingItem } from "@/lib/provider-success/types";

export function ProfileCompletionRing({
  percent,
  missing,
}: {
  percent: number;
  missing: ProfileMissingItem[];
}) {
  const t = useTranslations("business.success.profile");
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;

  const hrefFor = (item: ProfileMissingItem): string => {
    if (item === "gallery" || item === "logo" || item === "cover") return "/business/media";
    if (item === "services") return "/business/services";
    if (item === "verification") return "/business/verification";
    if (item === "hours") return "/business/profile";
    return "/business/profile";
  };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm" aria-labelledby="profile-ring-title">
      <div>
        <h2 id="profile-ring-title" className="text-lg font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div
          className="relative size-28 shrink-0"
          role="img"
          aria-label={t("progressAria", { percent })}
        >
          <svg viewBox="0 0 100 100" className="-rotate-90">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/40"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="var(--dalily-gold)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
            {percent}%
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("complete")}</p>
          ) : (
            <>
              <p className="text-sm font-medium">{t("missingTitle")}</p>
              <ul className="flex flex-wrap gap-2">
                {missing.map((item) => (
                  <li key={item}>
                    <Link
                      href={hrefFor(item)}
                      className="inline-flex min-h-11 items-center rounded-full border border-border bg-muted/40 px-3 text-xs font-medium hover:border-[var(--dalily-gold)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
                    >
                      {t(`missing.${item}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
