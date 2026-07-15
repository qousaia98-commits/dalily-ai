import { Link } from "@/lib/i18n/routing";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { BusinessHealthResult } from "@/lib/business/health-score";
import { cn } from "@/lib/utils";

export async function GrowthHealthCard({ health }: { health: BusinessHealthResult }) {
  const t = await getTranslations("business.growth.health");
  const ring = Math.min(100, health.score);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-[0_14px_36px_-20px_rgba(11,21,38,0.2)] sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div
          className="relative mx-auto flex size-28 shrink-0 items-center justify-center rounded-full sm:mx-0"
          style={{
            background: `conic-gradient(var(--dalily-gold) ${ring * 3.6}deg, #E8ECF2 0deg)`,
          }}
          role="img"
          aria-label={t("scoreAria", { score: health.score })}
        >
          <div className="flex size-[5.5rem] flex-col items-center justify-center rounded-full bg-white">
            <span className="text-3xl font-bold tracking-tight text-[var(--dalily-navy)]">
              {health.score}
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("label")}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#5C6478]">{t("subtitle")}</p>

          {health.suggestions.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {health.suggestions.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-[var(--dalily-navy)]">
                  <Circle className="mt-0.5 size-3.5 shrink-0 text-[var(--dalily-gold)]" />
                  <span>{t(`suggestions.${item.suggestionKey}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-4" />
              {t("complete")}
            </p>
          )}

          <Link
            href="/business/profile"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--dalily-navy)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t("cta")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {health.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-xl px-2.5 py-2 text-center text-[11px] font-semibold",
              item.done
                ? "bg-emerald-50 text-emerald-700"
                : "bg-[#F7F8FA] text-muted-foreground",
            )}
          >
            {t(`items.${item.id}`)}
          </div>
        ))}
      </div>
    </section>
  );
}
