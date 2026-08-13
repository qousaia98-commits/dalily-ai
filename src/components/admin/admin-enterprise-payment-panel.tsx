"use client";

import { useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  adminProcessPayout,
  adminRefundEscrow,
  adminReleaseEscrow,
  adminRetryPayout,
} from "@/actions/enterprise-payment.actions";

type Overview = {
  walletsActive: number;
  walletsBalanceTotal: number;
  escrowReserved: number;
  escrowDisputed: number;
  payoutsPending: number;
  payoutsPaid: number;
  openDisputes: number;
  feeRulesEnabled: number;
};

type EscrowRow = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  customer_id: string;
  provider_id: string;
  created_at: string;
};

type PayoutRow = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  created_at: string;
};

type FeeRow = {
  id: string;
  code: string;
  name: string;
  fee_type: string;
  percent_bps: number;
  enabled: boolean;
};

type DisputeRow = {
  id: string;
  status: string;
  reason_code: string;
  escrow_id: string | null;
  created_at: string;
};

export function AdminEnterprisePaymentPanel(props: {
  overview: Overview;
  escrows: EscrowRow[];
  payouts: PayoutRow[];
  feeRules: FeeRow[];
  disputes: DisputeRow[];
}) {
  const t = useTranslations("admin.enterprisePayments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const stats = [
    { label: t("stats.wallets"), value: props.overview.walletsActive },
    {
      label: t("stats.balance"),
      value: props.overview.walletsBalanceTotal.toFixed(2),
    },
    { label: t("stats.escrowReserved"), value: props.overview.escrowReserved },
    { label: t("stats.escrowDisputed"), value: props.overview.escrowDisputed },
    { label: t("stats.payoutsPending"), value: props.overview.payoutsPending },
    { label: t("stats.payoutsPaid"), value: props.overview.payoutsPaid },
    { label: t("stats.disputes"), value: props.overview.openDisputes },
    { label: t("stats.feeRules"), value: props.overview.feeRulesEnabled },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("escrowTitle")}</h2>
        {props.escrows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-start">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("cols.status")}</th>
                  <th className="px-3 py-2 font-medium">{t("cols.amount")}</th>
                  <th className="px-3 py-2 font-medium">{t("cols.created")}</th>
                  <th className="px-3 py-2 font-medium">{t("cols.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {props.escrows.slice(0, 40).map((e) => (
                  <tr key={e.id} className="border-t border-border/40">
                    <td className="px-3 py-2">{e.status}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {e.amount} {e.currency}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {e.status === "reserved" || e.status === "disputed" ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="text-xs font-medium text-[var(--dalily-gold)] hover:underline disabled:opacity-50"
                            onClick={() =>
                              run(() => adminReleaseEscrow({ escrowId: e.id }))
                            }
                          >
                            {t("actions.release")}
                          </button>
                        ) : null}
                        {e.status === "reserved" || e.status === "disputed" ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                            onClick={() =>
                              run(() =>
                                adminRefundEscrow({
                                  escrowId: e.id,
                                  reason: "admin_refund",
                                }),
                              )
                            }
                          >
                            {t("actions.refund")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("payoutTitle")}</h2>
        {props.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-start">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("cols.status")}</th>
                  <th className="px-3 py-2 font-medium">{t("cols.amount")}</th>
                  <th className="px-3 py-2 font-medium">{t("cols.method")}</th>
                  <th className="px-3 py-2 font-medium">{t("cols.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {props.payouts.slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-t border-border/40">
                    <td className="px-3 py-2">{p.status}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {p.amount} {p.currency}
                    </td>
                    <td className="px-3 py-2">{p.method}</td>
                    <td className="px-3 py-2">
                      {p.status === "failed" ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-xs font-medium text-[var(--dalily-gold)] hover:underline disabled:opacity-50"
                          onClick={() =>
                            run(() => adminRetryPayout({ payoutId: p.id }))
                          }
                        >
                          {t("actions.retry")}
                        </button>
                      ) : null}
                      {p.status === "pending" || p.status === "scheduled" ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-xs font-medium text-[var(--dalily-gold)] hover:underline disabled:opacity-50"
                          onClick={() =>
                            run(() => adminProcessPayout({ payoutId: p.id }))
                          }
                        >
                          {t("actions.process")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("feesTitle")}</h2>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {props.feeRules.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span>
                {f.name}{" "}
                <span className="text-muted-foreground">({f.code})</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {f.fee_type} · {(f.percent_bps / 100).toFixed(2)}% ·{" "}
                {f.enabled ? t("enabled") : t("disabled")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("disputesTitle")}</h2>
        {props.disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {props.disputes.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {d.status} · {d.reason_code}
                </span>
                <span className="text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
