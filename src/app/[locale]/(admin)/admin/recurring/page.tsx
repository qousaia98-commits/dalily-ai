import { requireAdminUser } from "@/lib/auth/session";
import { isRecurringServicesEnabled } from "@/lib/config/feature-flags";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { optimizeRecurringRoutes } from "@/lib/recurring";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminRecurringPage() {
  await requireAdminUser();
  if (!isRecurringServicesEnabled()) {
    redirect("/admin/analytics");
  }

  const t = await getTranslations("admin.recurring");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let active = 0;
  let paused = 0;
  let visitsUpcoming = 0;
  try {
    const [{ count: a }, { count: p }, { count: v }] = await Promise.all([
      admin
        .from("recurring_plans")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .from("recurring_plans")
        .select("id", { count: "exact", head: true })
        .eq("status", "paused"),
      admin
        .from("recurring_visits")
        .select("id", { count: "exact", head: true })
        .in("status", ["scheduled", "confirmed", "rescheduled"])
        .gte("planned_starts_at", new Date().toISOString()),
    ]);
    active = a ?? 0;
    paused = p ?? 0;
    visitsUpcoming = v ?? 0;
  } catch {
    /* soft until migration */
  }

  const routeHints = await optimizeRecurringRoutes();

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
        <Kpi label={t("kpis.paused")} value={`${paused}`} />
        <Kpi label={t("kpis.upcoming")} value={`${visitsUpcoming}`} />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("optimizeTitle")}</h2>
        {routeHints.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("optimizeEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {routeHints.slice(0, 8).map((h) => (
              <li key={`${h.providerId}-${h.date}-${h.visitIds.join("-")}`}>
                • {h.messageEn}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/account/recurring"
        className="text-sm text-[var(--dalily-gold)] underline"
      >
        {t("customerView")}
      </Link>
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
