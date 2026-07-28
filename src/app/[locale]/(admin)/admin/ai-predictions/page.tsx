import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isPredictiveEngineEnabled } from "@/lib/config/feature-flags";
import { redirect } from "next/navigation";
import { buildAdminPredictiveDashboard } from "@/domains/forecast";
import { Link } from "@/lib/i18n/routing";

export default async function AdminAiPredictionsPage() {
  await requireAdminUser();
  if (!isPredictiveEngineEnabled()) {
    redirect("/admin/analytics");
  }

  const t = await getTranslations("admin.predictive");
  const dash = await buildAdminPredictiveDashboard();

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t("kpis.health")} value={`${dash.healthScore}`} />
        <Kpi
          label={t("kpis.accuracy")}
          value={
            dash.predictionAccuracyPct != null
              ? `${dash.predictionAccuracyPct}%`
              : "—"
          }
        />
        <Kpi
          label={t("kpis.avgResponse")}
          value={
            dash.averageResponseMinutes != null
              ? `${dash.averageResponseMinutes}m`
              : "—"
          }
        />
        <Kpi
          label={t("kpis.completion")}
          value={
            dash.completionTrendPct != null ? `${dash.completionTrendPct}%` : "—"
          }
        />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("demandTitle")}</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {dash.demand.highlightsEn.map((h) => (
            <li key={h}>• {h}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("balanceTitle")}</h2>
        {dash.balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("balanceEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dash.balances.slice(0, 8).map((b) => (
              <li
                key={`${b.categorySlug}-${b.severity}`}
                className="flex flex-col gap-0.5 rounded-xl border border-border/60 px-3 py-2"
              >
                <span className="font-medium capitalize">
                  {b.categorySlug} · {b.severity.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {b.explanationEn}
                </span>
                {b.recommendedActions.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("actions")}: {b.recommendedActions.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("topServices")}</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {dash.insights.mostRequestedServices.map((s) => (
              <li key={s.categorySlug} className="flex justify-between gap-2">
                <span>{s.categorySlug}</span>
                <span className="tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("growing")}</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {dash.insights.fastestGrowingCategories.map((s) => (
              <li key={s.categorySlug} className="flex justify-between gap-2">
                <span>{s.categorySlug}</span>
                <span className="tabular-nums">
                  {s.growthPct > 0 ? "+" : ""}
                  {s.growthPct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">{t("heatmap")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {dash.heatmap.map((h) => (
            <li key={h.label} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block size-2.5 rounded-full bg-[var(--dalily-gold)]"
                style={{ opacity: 0.25 + h.intensity * 0.75 }}
                aria-hidden
              />
              <span className="flex-1 truncate">{h.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(h.intensity * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">{t("peakHours")}</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {dash.insights.peakHours.map((p) => (
            <li
              key={p.hour}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs"
            >
              {String(p.hour).padStart(2, "0")}:00 · {p.count}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/analytics" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.analytics")}
        </Link>
        <Link href="/admin/marketplace" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.marketplace")}
        </Link>
        <Link href="/admin/learning" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.learning")}
        </Link>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
