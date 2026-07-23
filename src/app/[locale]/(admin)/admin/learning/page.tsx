import { getLocale, getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getLearningAnalytics } from "@/lib/admin/learning-analytics";
import type { Locale } from "@/lib/i18n/config";
import { recomputeAllPerformanceAction } from "@/actions/learning.actions";
import { Button } from "@/components/ui/button";

export default async function AdminLearningPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.learning");
  const locale = (await getLocale()) as Locale;
  const stats = await getLearningAnalytics(locale);

  const cards = [
    { label: t("totalEvents"), value: String(stats.totalEvents) },
    { label: t("eventsWeek"), value: String(stats.eventsLast7Days) },
    { label: t("providersScored"), value: String(stats.providersScored) },
    {
      label: t("avgScore"),
      value:
        stats.avgPerformanceScore != null
          ? `${Math.round(stats.avgPerformanceScore * 100)}%`
          : "—",
    },
    {
      label: t("avgQuality"),
      value:
        stats.avgDataQuality != null
          ? `${Math.round(stats.avgDataQuality * 100)}%`
          : "—",
    },
    { label: t("preferenceProfiles"), value: String(stats.preferenceProfiles) },
    {
      label: t("recommendationAccuracy"),
      value:
        stats.recommendationAccuracy != null
          ? `${stats.recommendationAccuracy}%`
          : "—",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <form action={recomputeAllPerformanceAction}>
          <Button type="submit" variant="outline" className="rounded-xl">
            {t("recompute")}
          </Button>
        </form>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaderList
          title={t("topPerformers")}
          empty={t("empty")}
          rows={stats.topPerformers.map((r) => ({
            id: r.providerId,
            name: r.name,
            value: `${Math.round(r.score * 100)}% · n=${r.sampleSize}`,
          }))}
        />
        <LeaderList
          title={t("fastestResponders")}
          empty={t("empty")}
          rows={stats.fastestResponders.map((r) => ({
            id: r.providerId,
            name: r.name,
            value: `${r.avgResponseHours.toFixed(1)}h · n=${r.sampleSize}`,
          }))}
        />
        <LeaderList
          title={t("highestCompletion")}
          empty={t("empty")}
          rows={stats.highestCompletion.map((r) => ({
            id: r.providerId,
            name: r.name,
            value: `${Math.round(r.completionRate * 100)}% · n=${r.sampleSize}`,
          }))}
        />
        <LeaderList
          title={t("highestRepeat")}
          empty={t("empty")}
          rows={stats.highestRepeat.map((r) => ({
            id: r.providerId,
            name: r.name,
            value: `${Math.round(r.repeatRate * 100)}% · n=${r.sampleSize}`,
          }))}
        />
      </div>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-4 font-bold">{t("eventBreakdown")}</h2>
        {stats.eventBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {stats.eventBreakdown.map((e) => (
              <li key={e.eventType} className="flex justify-between text-sm">
                <span className="font-mono text-xs">{e.eventType}</span>
                <span className="font-semibold">{e.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LeaderList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; name: string; value: string }>;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-4 font-bold">{title}</h2>
      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">{empty}</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 font-semibold">{r.value}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
