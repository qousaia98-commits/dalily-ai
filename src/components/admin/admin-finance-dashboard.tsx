"use client";

import { useState, useTransition } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  exportFinanceReportCsvAction,
  exportFinanceReportPdfAction,
  getFinanceDashboardAction,
} from "@/actions/finance-analytics.actions";
import type {
  FinanceDashboardSnapshot,
  FinancePeriod,
} from "@/lib/finance-analytics";
import { FinanceChartsGrid } from "@/components/admin/finance-charts";
import { formatDateTime } from "@/lib/format/datetime";
import { Link } from "@/lib/i18n/navigation";

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminFinanceDashboard({
  initialSnapshot,
}: {
  initialSnapshot: FinanceDashboardSnapshot;
}) {
  const t = useTranslations("admin.finance");
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [period, setPeriod] = useState<FinancePeriod>("monthly");
  const [pending, startTransition] = useTransition();

  function refresh(force = true) {
    startTransition(async () => {
      const result = await getFinanceDashboardAction({ forceRefresh: force });
      if (!result.ok) {
        toast.error(t("loadError"));
        return;
      }
      setSnapshot(result.snapshot);
      toast.success(t("refreshed"));
    });
  }

  function exportCsv() {
    startTransition(async () => {
      const result = await exportFinanceReportCsvAction(period);
      if (!result.ok) {
        toast.error(t("exportError"));
        return;
      }
      downloadBlob(
        result.filename,
        new Blob([result.csv], { type: "text/csv;charset=utf-8" }),
      );
      toast.success(t("exportSuccess"));
    });
  }

  function exportPdf() {
    startTransition(async () => {
      const result = await exportFinanceReportPdfAction(period);
      if (!result.ok) {
        toast.error(t("exportError"));
        return;
      }
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      downloadBlob(result.filename, new Blob([bytes], { type: "application/pdf" }));
      toast.success(t("exportSuccess"));
    });
  }

  const { revenue, subscriptions, leads, refunds } = snapshot;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => refresh(true)}
        >
          <RefreshCw className="me-1.5 size-3.5" />
          {t("refresh")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("computedAt", {
            at: formatDateTime(snapshot.computedAt, locale),
            cache: snapshot.fromCache ? t("fromCache") : t("live"),
          })}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("revenueTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label={t("kpis.today")} value={money(revenue.today)} />
          <KpiCard label={t("kpis.thisWeek")} value={money(revenue.thisWeek)} />
          <KpiCard label={t("kpis.thisMonth")} value={money(revenue.thisMonth)} />
          <KpiCard label={t("kpis.thisYear")} value={money(revenue.thisYear)} />
          <KpiCard label={t("kpis.lifetime")} value={money(revenue.lifetime)} />
          <KpiCard label={t("kpis.mrr")} value={money(revenue.mrr)} />
          <KpiCard label={t("kpis.arr")} value={money(revenue.arr)} />
          <KpiCard label={t("kpis.arpp")} value={money(revenue.arpp)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("subscriptionsTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t("kpis.activeBusiness")}
            value={String(subscriptions.activeBusiness)}
          />
          <KpiCard
            label={t("kpis.freeProviders")}
            value={String(subscriptions.freeProviders)}
          />
          <KpiCard
            label={t("kpis.newSubscriptions")}
            value={String(subscriptions.newSubscriptions)}
          />
          <KpiCard label={t("kpis.renewals")} value={String(subscriptions.renewals)} />
          <KpiCard
            label={t("kpis.expiringSoon")}
            value={String(subscriptions.expiringSoon)}
          />
          <KpiCard label={t("kpis.cancelled")} value={String(subscriptions.cancelled)} />
          <KpiCard
            label={t("kpis.conversionRate")}
            value={`${subscriptions.conversionRate}%`}
          />
          <KpiCard
            label={t("kpis.churnRate")}
            value={`${subscriptions.churnRate}%`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("leadsTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label={t("kpis.unlockedLeads")}
            value={String(leads.unlockedLeads)}
          />
          <KpiCard
            label={t("kpis.avgLeadPrice")}
            value={money(leads.averageLeadPrice)}
          />
          <KpiCard
            label={t("kpis.leadRevenue")}
            value={money(leads.totalLeadRevenue)}
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <BreakdownList title={t("byCategory")} rows={leads.byCategory} />
          <BreakdownList title={t("byCountry")} rows={leads.byCountry} />
          <BreakdownList title={t("byCity")} rows={leads.byCity} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("refundsTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label={t("kpis.refundCount")} value={String(refunds.refundCount)} />
          <KpiCard label={t("kpis.refundVolume")} value={money(refunds.refundVolume)} />
          <KpiCard label={t("kpis.refundRate")} value={`${refunds.refundRate}%`} />
          <KpiCard
            label={t("kpis.partialVsFull")}
            value={`${refunds.partialRefunds} / ${refunds.fullRefunds}`}
          />
          <KpiCard label={t("kpis.openDisputes")} value={String(refunds.openDisputes)} />
          <KpiCard label={t("kpis.wonDisputes")} value={String(refunds.wonDisputes)} />
          <KpiCard label={t("kpis.lostDisputes")} value={String(refunds.lostDisputes)} />
          <KpiCard
            label={t("kpis.avgResolution")}
            value={`${refunds.averageResolutionHours}h`}
          />
        </div>
        {refunds.topRefundReasons.length > 0 ? (
          <ul className="rounded-2xl border border-border bg-card p-4 text-sm space-y-1">
            <li className="font-semibold">{t("topReasons")}</li>
            {refunds.topRefundReasons.map((r) => (
              <li key={r.reason} className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate">{r.reason}</span>
                <span className="tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <FinanceChartsGrid charts={snapshot.charts} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("providersTitle")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-start">
              <tr>
                <th className="px-3 py-2 font-semibold">{t("table.provider")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.plan")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.revenue")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.unlocks")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.ltv")}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.topProviders.map((p) => (
                <tr key={p.providerId} className="border-t border-border">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 capitalize">{p.billingMode}</td>
                  <td className="px-3 py-2 tabular-nums">{money(p.revenue)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.unlocks}</td>
                  <td className="px-3 py-2 tabular-nums">{money(p.lifetimeValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("businessFreeRatio", {
            business: subscriptions.activeBusiness,
            free: subscriptions.freeProviders,
          })}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <RecentList
          title={t("recentTransactions")}
          items={snapshot.recentTransactions}
          locale={locale}
          linkHref="/admin/payments"
          linkLabel={t("viewAllPayments")}
        />
        <RecentList
          title={t("recentRefunds")}
          items={snapshot.recentRefunds}
          locale={locale}
          linkHref="/admin/refunds"
          linkLabel={t("viewAllRefunds")}
        />
        <RecentList
          title={t("recentSubscriptions")}
          items={snapshot.recentSubscriptions}
          locale={locale}
          linkHref="/admin/payments"
          linkLabel={t("viewAllPayments")}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("reportsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("reportsSubtitle")}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "daily",
              "weekly",
              "monthly",
              "quarterly",
              "yearly",
            ] as FinancePeriod[]
          ).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? "rounded-xl bg-[var(--dalily-navy)] px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
              }
            >
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={exportCsv}>
            <Download className="me-1.5 size-3.5" />
            {t("exportCsv")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={exportPdf}
          >
            <FileText className="me-1.5 size-3.5" />
            {t("exportPdf")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.slice(0, 8).map((r) => (
            <li key={r.label} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground">{r.label}</span>
              <span className="tabular-nums font-medium">${r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentList({
  title,
  items,
  locale,
  linkHref,
  linkLabel,
}: {
  title: string;
  items: FinanceDashboardSnapshot["recentTransactions"];
  locale: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Link
          href={linkHref}
          className="text-xs text-[var(--dalily-gold)] hover:underline"
        >
          {linkLabel}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(item.at, locale)} · {item.status}
                </p>
              </div>
              <p className="shrink-0 tabular-nums font-semibold">
                ${item.amount} {item.currency}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
