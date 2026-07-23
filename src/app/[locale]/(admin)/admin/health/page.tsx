import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getSystemHealthSnapshot } from "@/lib/admin/system-health";
import { listAdminAiExtensions } from "@/lib/admin/ai-hooks";

export default async function AdminHealthPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.health");
  const health = await getSystemHealthSnapshot();
  const ai = listAdminAiExtensions();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["database", health.databaseStatus],
            ["realtime", health.realtimeStatus],
            ["storage", health.storageUsageLabel],
            ["queue", health.queueStatus],
            ["api", health.apiHealth],
            ["version", health.deploymentVersion],
            ["environment", health.environment],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-2xl border bg-card px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`fields.${key}`)}
            </p>
            <p className="mt-2 text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("cronTitle")}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {health.cronJobs.map((job) => (
            <li key={job.name} className="flex justify-between">
              <span>{job.name}</span>
              <span className="text-muted-foreground">{job.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed bg-muted/20 p-4">
        <h2 className="font-semibold">{t("aiReadyTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("aiReadyBody")}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ai.map((ext) => (
            <li key={ext} className="rounded-full border px-2.5 py-1 text-xs">
              {ext}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
