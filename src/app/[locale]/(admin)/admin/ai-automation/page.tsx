import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAiEngineV9Enabled } from "@/lib/config/feature-flags";
import { redirect } from "next/navigation";
import { buildAdminAutomationDashboard } from "@/lib/ai/automation/dashboard";
import { Link } from "@/lib/i18n/routing";

export default async function AdminAiAutomationPage() {
  await requireAdminUser();
  if (!isAiEngineV9Enabled()) {
    redirect("/admin/analytics");
  }

  const t = await getTranslations("admin.automation");
  const dash = await buildAdminAutomationDashboard();

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t("kpis.executed")} value={`${dash.executedCount}`} />
        <Kpi label={t("kpis.pending")} value={`${dash.pendingApprovals}`} />
        <Kpi
          label={t("kpis.accuracy")}
          value={dash.accuracyPct != null ? `${dash.accuracyPct}%` : "—"}
        />
        <Kpi
          label={t("kpis.acceptance")}
          value={
            dash.acceptanceRatePct != null
              ? `${dash.acceptanceRatePct}%`
              : "—"
          }
        />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("pendingTitle")}</h2>
        {dash.pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pendingEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dash.pending.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border/60 px-3 py-2"
              >
                <p className="font-medium">{p.titleEn}</p>
                <p className="text-xs text-muted-foreground">{p.bodyEn}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("successful")}</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {dash.mostSuccessfulWorkflows.length === 0 ? (
              <li>{t("noWorkflows")}</li>
            ) : (
              dash.mostSuccessfulWorkflows.map((w) => (
                <li key={w.workflowId} className="flex justify-between gap-2">
                  <span className="truncate">{w.workflowId}</span>
                  <span className="tabular-nums">{w.successCount}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("rejected")}</h2>
          <p className="text-2xl font-bold">{dash.rejectedSuggestions}</p>
          <p className="text-xs text-muted-foreground">{t("rejectedHint")}</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        <ul className="space-y-2 text-sm">
          {dash.recentActions.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-0.5 rounded-xl border border-border/50 px-3 py-2"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium truncate">{a.actionType}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {a.status}
                  {a.confidence != null
                    ? ` · ${Math.round(a.confidence * 100)}%`
                    : ""}
                </span>
              </div>
              <span className="text-xs text-muted-foreground line-clamp-2">
                {a.reasonEn}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/ai-predictions"
          className="rounded-lg border px-3 py-1.5 hover:bg-muted"
        >
          {t("links.predictions")}
        </Link>
        <Link
          href="/admin/learning"
          className="rounded-lg border px-3 py-1.5 hover:bg-muted"
        >
          {t("links.learning")}
        </Link>
        <Link
          href="/admin/analytics"
          className="rounded-lg border px-3 py-1.5 hover:bg-muted"
        >
          {t("links.analytics")}
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
