import { requireAdminUser } from "@/lib/auth/session";
import { isEmergencyDispatchEnabled } from "@/lib/config/feature-flags";
import { redirect } from "next/navigation";
import { getEmergencyAdminDashboard } from "@/lib/ai/dispatch/emergency";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";

export default async function AdminEmergencyPage() {
  await requireAdminUser();
  if (!isEmergencyDispatchEnabled()) {
    redirect("/admin/analytics");
  }

  const t = await getTranslations("admin.emergency");
  const dash = await getEmergencyAdminDashboard();

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
        <Kpi label={t("kpis.active")} value={`${dash.activeCount}`} />
        <Kpi
          label={t("kpis.avgResponse")}
          value={
            dash.avgResponseSeconds != null
              ? `${Math.round(dash.avgResponseSeconds / 60)}m`
              : "—"
          }
        />
        <Kpi
          label={t("kpis.avgEta")}
          value={dash.avgEtaMinutes != null ? `${dash.avgEtaMinutes}m` : "—"}
        />
        <Kpi
          label={t("kpis.successRate")}
          value={
            dash.successfulDispatchRatePct != null
              ? `${dash.successfulDispatchRatePct}%`
              : "—"
          }
        />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("activeTitle")}</h2>
        {dash.active.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("activeEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {dash.active.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-xl border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {row.categorySlug ?? "—"} · {row.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.etaLabel ?? t("noEta")} ·{" "}
                    {new Date(row.activatedAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/request/${row.serviceRequestId}/waiting`}
                  className="text-xs font-medium text-[var(--dalily-gold)] underline"
                >
                  {t("openRequest")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("volumeTitle")}</h2>
        {dash.regionalVolume.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("volumeEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {dash.regionalVolume.map((r) => (
              <li
                key={r.label}
                className="flex justify-between border-b border-border/40 py-1.5 last:border-0"
              >
                <span className="capitalize text-muted-foreground">{r.label}</span>
                <span className="font-medium">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
