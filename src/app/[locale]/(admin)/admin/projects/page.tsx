import { requireAdminUser } from "@/lib/auth/session";
import { isMultiServiceProjectsEnabled } from "@/lib/config/feature-flags";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminProjectsPage() {
  await requireAdminUser();
  if (!isMultiServiceProjectsEnabled()) {
    redirect("/admin/analytics");
  }

  const t = await getTranslations("admin.projects");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let rows: Array<{
    id: string;
    title: string;
    status: string;
    completion_pct: number;
    created_at: string;
    estimated_days_min: number | null;
    estimated_days_max: number | null;
  }> = [];

  try {
    const { data } = await admin
      .from("service_projects")
      .select(
        "id, title, status, completion_pct, created_at, estimated_days_min, estimated_days_max",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    rows = data ?? [];
  } catch {
    rows = [];
  }

  const active = rows.filter((r) =>
    ["planning", "offers", "booked", "in_progress"].includes(r.status),
  ).length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const avgPct =
    rows.length > 0
      ? Math.round(
          rows.reduce((s, r) => s + Number(r.completion_pct ?? 0), 0) /
            rows.length,
        )
      : 0;

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label={t("kpis.active")} value={`${active}`} />
        <Kpi label={t("kpis.completed")} value={`${completed}`} />
        <Kpi label={t("kpis.avgProgress")} value={`${avgPct}%`} />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("listTitle")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-xl border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.status} · {row.completion_pct}% ·{" "}
                    {row.estimated_days_min != null
                      ? `${row.estimated_days_min}–${row.estimated_days_max ?? row.estimated_days_min}d`
                      : "—"}
                  </p>
                </div>
                <Link
                  href={`/account/projects/${row.id}`}
                  className="text-xs font-medium text-[var(--dalily-gold)] underline"
                >
                  {t("open")}
                </Link>
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
