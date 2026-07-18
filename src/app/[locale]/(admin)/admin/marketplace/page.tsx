import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getMarketplaceStats } from "@/lib/admin/marketplace-stats";

export default async function AdminMarketplacePage() {
  await requireAdminUser();
  const t = await getTranslations("admin.marketplace");
  const stats = await getMarketplaceStats();

  const cards = [
    { label: t("totalRequests"), value: String(stats.totalRequests) },
    { label: t("acceptanceRate"), value: `${stats.acceptanceRate}%` },
    { label: t("quoteAcceptanceRate"), value: `${stats.quoteAcceptanceRate}%` },
    { label: t("completionRate"), value: `${stats.completionRate}%` },
    { label: t("disputeRate"), value: `${stats.disputeRate}%` },
    {
      label: t("avgResponse"),
      value:
        stats.averageResponseHours != null
          ? `${stats.averageResponseHours.toFixed(1)}h`
          : "—",
    },
    {
      label: t("avgCompletion"),
      value:
        stats.averageCompletionHours != null
          ? `${stats.averageCompletionHours.toFixed(1)}h`
          : "—",
    },
    {
      label: t("avgRating"),
      value: stats.averageRating != null ? String(stats.averageRating) : "—",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
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
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="mb-4 font-bold">{t("topBusinesses")}</h2>
          <ul className="space-y-2">
            {stats.topBusinesses.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("empty")}</li>
            ) : (
              stats.topBusinesses.map((b) => (
                <li key={b.providerId} className="flex justify-between text-sm">
                  <span>{b.name}</span>
                  <span className="font-semibold">{b.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="mb-4 font-bold">{t("activeCustomers")}</h2>
          <ul className="space-y-2">
            {stats.mostActiveCustomers.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("empty")}</li>
            ) : (
              stats.mostActiveCustomers.map((c) => (
                <li key={c.userId} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="font-semibold">{c.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBlock title={t("daily")} items={stats.daily.map((d) => ({ label: d.day.slice(5), value: d.count }))} />
        <ChartBlock title={t("monthly")} items={stats.monthly.map((m) => ({ label: m.month, value: m.count }))} />
      </div>
    </div>
  );
}

function ChartBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-4 font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="flex h-40 items-end gap-1.5">
          {items.map((item) => (
            <li key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className="w-full rounded-t-md bg-[var(--dalily-gold)]/80 transition"
                style={{ height: `${(item.value / max) * 100}%`, minHeight: item.value > 0 ? 4 : 0 }}
                title={`${item.label}: ${item.value}`}
              />
              <span className="truncate text-[0.6rem] text-muted-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
