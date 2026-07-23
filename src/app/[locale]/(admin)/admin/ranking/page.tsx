import { getLocale, getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getAdminRankingInspection } from "@/lib/admin/ranking-inspection";
import { DALILY_SCORE_COMPONENT_KEYS } from "@/lib/dalily-ranking/weights";
import type { Locale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/routing";

export default async function AdminRankingPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.ranking");
  const locale = (await getLocale()) as Locale;
  const rows = await getAdminRankingInspection(locale, 40);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{t("weightsTitle")}</p>
        <p className="mt-1">{t("weightsBody")}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {DALILY_SCORE_COMPONENT_KEYS.map((key) => (
            <li
              key={key}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
            >
              {t(`components.${key}`)}:{" "}
              {rows[0] ? Math.round(rows[0].weights[key] * 100) : "—"}%
            </li>
          ))}
        </ul>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.providerId}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">#{index + 1}</p>
                  <Link
                    href={`/admin/providers/${row.providerId}`}
                    className="text-base font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("strengths")}:{" "}
                    {row.explanation.topStrengths
                      .map((s) => t(`components.${s}`))
                      .join(", ")}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-2xl font-bold">{row.breakdown.overall}</p>
                  <p className="text-xs text-muted-foreground">{t("score")}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {DALILY_SCORE_COMPONENT_KEYS.map((key) => (
                  <div key={key} className="rounded-xl bg-muted/30 px-2 py-1.5">
                    <p className="truncate text-[0.6rem] uppercase text-muted-foreground">
                      {t(`components.${key}`)}
                    </p>
                    <p className="text-sm font-semibold">
                      {Math.round(row.breakdown.components[key] * 100)}
                    </p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
