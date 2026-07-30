"use client";

import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import type { AiAdminCenterOverview } from "@/domains/ai/admin/overview";

export function AdminAiPlatformPanel({
  overview,
}: {
  overview: AiAdminCenterOverview;
}) {
  const t = useTranslations("admin.aiPlatform");
  const { health } = overview;

  const stats = [
    { label: t("stats.requests"), value: health.usage24h.requests },
    { label: t("stats.errors"), value: health.usage24h.errors },
    {
      label: t("stats.latency"),
      value: health.usage24h.avgLatencyMs ?? "—",
    },
    { label: t("stats.fallbacks"), value: health.usage24h.fallbacks },
    { label: t("stats.fraud"), value: health.openFraudAlerts },
    { label: t("stats.moderation"), value: health.openModerationReports },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/60 bg-background/80 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("providersTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("providersBody", {
            primary: health.primaryProvider,
            fallback: health.fallbackProvider,
          })}
        </p>
        <ul className="flex flex-wrap gap-2 text-xs">
          {(
            Object.entries(health.flags) as Array<[string, boolean]>
          ).map(([k, v]) => (
            <li
              key={k}
              className={`rounded-full border px-3 py-1 ${
                v
                  ? "border-[var(--dalily-gold)]/50 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {k}: {v ? t("on") : t("off")}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("centersTitle")}</h2>
        <div className="flex flex-wrap gap-3">
          {overview.linkedCenters.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              className={`text-sm hover:underline ${
                c.enabled
                  ? "text-[var(--dalily-gold)]"
                  : "text-muted-foreground"
              }`}
            >
              {c.id}
              {!c.enabled ? ` (${t("off")})` : ""} →
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("usageTitle")}</h2>
        {overview.recentUsage.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {overview.recentUsage.slice(0, 15).map((u, i) => (
              <li
                key={`${u.createdAt}-${i}`}
                className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {u.feature} · {u.providerId} ·{" "}
                  {u.success ? t("ok") : t("fail")}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {u.latencyMs != null ? `${u.latencyMs}ms` : "—"} ·{" "}
                  {new Date(u.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("moderationTitle")}</h2>
        {overview.recentModeration.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {overview.recentModeration.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {m.riskLevel} · {m.suggestedAction} · {m.status}
                </span>
                <span className="text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
