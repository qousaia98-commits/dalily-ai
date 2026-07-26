"use client";

import { useState, useTransition } from "react";
import { Search, Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addDisputeEvidenceAction,
  approveRefundAction,
  listAdminRefundsAction,
  rejectRefundAction,
} from "@/actions/refund.actions";
import type { PaymentDispute, RefundRequest } from "@/lib/refunds";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

export function AdminRefundsPanel({
  initialRefunds,
  initialStats,
  initialDisputes,
}: {
  initialRefunds: RefundRequest[];
  initialStats: {
    total: number;
    requested: number;
    succeeded: number;
    failed: number;
    refundedUsd: number;
  };
  initialDisputes: PaymentDispute[];
}) {
  const t = useTranslations("admin.refunds");
  const locale = useLocale();
  const [refunds, setRefunds] = useState(initialRefunds);
  const [stats, setStats] = useState(initialStats);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [status, setStatus] = useState<"all" | RefundRequest["status"]>("all");
  const [query, setQuery] = useState("");
  const [evidenceNote, setEvidenceNote] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function reload(next?: { status?: typeof status; query?: string }) {
    const s = next?.status ?? status;
    const q = next?.query ?? query;
    startTransition(async () => {
      const result = await listAdminRefundsAction({
        status: s,
        query: q,
      });
      if (!result.ok) {
        toast.error(t("loadError"));
        return;
      }
      setRefunds(result.refunds);
      setStats(result.stats);
      setDisputes(result.disputes);
    });
  }

  function approve(id: string) {
    startTransition(async () => {
      const result = await approveRefundAction(id);
      if (!result.ok) {
        toast.error(t("approveError"));
        return;
      }
      toast.success(t("approveSuccess"));
      reload();
    });
  }

  function reject(id: string) {
    startTransition(async () => {
      const reason = window.prompt(t("rejectPrompt")) ?? "";
      const result = await rejectRefundAction({ refundId: id, reason });
      if (!result.ok) {
        toast.error(t("rejectError"));
        return;
      }
      toast.success(t("rejectSuccess"));
      reload();
    });
  }

  function uploadEvidence(disputeId: string) {
    startTransition(async () => {
      const note = (evidenceNote[disputeId] ?? "").trim();
      const result = await addDisputeEvidenceAction({ disputeId, note });
      if (!result.ok) {
        toast.error(t("evidenceError"));
        return;
      }
      toast.success(t("evidenceSuccess"));
      setEvidenceNote((prev) => ({ ...prev, [disputeId]: "" }));
      reload();
    });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [t("stats.total"), String(stats.total)],
          [t("stats.requested"), String(stats.requested)],
          [t("stats.succeeded"), String(stats.succeeded)],
          [t("stats.failed"), String(stats.failed)],
          [t("stats.refundedUsd"), `$${stats.refundedUsd}`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-11 rounded-2xl border border-border bg-card px-3 text-sm"
          value={status}
          onChange={(e) => {
            const v = e.target.value as typeof status;
            setStatus(v);
            reload({ status: v });
          }}
        >
          <option value="all">{t("filters.statusAll")}</option>
          {(
            [
              "requested",
              "pending",
              "approved",
              "processing",
              "succeeded",
              "rejected",
              "failed",
              "cancelled",
            ] as const
          ).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") reload({ query });
            }}
            placeholder={t("searchPlaceholder")}
            className="h-11 w-full rounded-2xl border border-border bg-card pe-3 ps-10 text-sm outline-none ring-[var(--dalily-gold)]/40 focus:ring-2"
          />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("refundsTitle")}</h2>
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyRefunds")}</p>
        ) : (
          <ul className="space-y-3">
            {refunds.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-4",
                  pending && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {r.refundAmount} {r.currency} · {t(`type.${r.refundType}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt, locale)} · {r.paymentReference ?? r.paymentId}
                    </p>
                    <p className="mt-1 text-sm">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("remaining")}: {r.remainingAmount} {r.currency}
                      {r.stripeRefundId
                        ? ` · Stripe ${r.stripeRefundId}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-medium">{t(`status.${r.status}`)}</p>
                    {["requested", "pending"].includes(r.status) ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => approve(r.id)}
                          disabled={pending}
                        >
                          <Check className="me-1 size-3.5" />
                          {t("approve")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => reject(r.id)}
                          disabled={pending}
                        >
                          <X className="me-1 size-3.5" />
                          {t("reject")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("disputesTitle")}</h2>
        {disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyDisputes")}</p>
        ) : (
          <ul className="space-y-3">
            {disputes.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-2"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {d.amount ?? "—"} {d.currency} · {t(`disputeStatus.${d.status}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.stripeDisputeId ?? d.id}
                      {d.reason ? ` · ${d.reason}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={evidenceNote[d.id] ?? ""}
                    onChange={(e) =>
                      setEvidenceNote((prev) => ({
                        ...prev,
                        [d.id]: e.target.value,
                      }))
                    }
                    placeholder={t("evidencePlaceholder")}
                    className="h-10 min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => uploadEvidence(d.id)}
                  >
                    {t("uploadEvidence")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
