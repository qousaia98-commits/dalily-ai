"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/routing";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  approvePaymentAction,
  rejectPaymentAction,
} from "@/actions/admin-payment.actions";
import { getLocalizedField } from "@/types/provider.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaymentEvent = {
  id: string;
  eventType: string;
  actorName: string | null;
  note: string | null;
  createdAt: string;
};

type PaymentDetail = {
  id: string;
  providerName: { ar: string; en: string };
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  planSlug: string;
  amount: number;
  currency: string;
  paymentReference: string;
  paymentStatus: string;
  receiptUrl: string | null;
  receiptMimeType: string | null;
  adminNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  events: PaymentEvent[];
};

export function AdminPaymentDetailPanel({ payment }: { payment: PaymentDetail }) {
  const t = useTranslations("admin.payments");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);

  const canDecide =
    payment.paymentStatus === "pending" || payment.paymentStatus === "pending_review";

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(t(`errors.${result.error ?? "unknown"}`));
        setDialog(null);
        return;
      }
      setDialog(null);
      router.push("/admin/payments");
      router.refresh();
    });
  }

  const infoRows = [
    { label: t("detail.company"), value: getLocalizedField(payment.providerName, locale) },
    { label: t("detail.owner"), value: payment.ownerName ?? "—" },
    { label: t("detail.email"), value: payment.ownerEmail ?? "—" },
    { label: t("detail.phone"), value: payment.phone ?? "—" },
    { label: t("detail.plan"), value: t(`plans.${payment.planSlug}`) },
    { label: t("detail.amount"), value: `${payment.amount} ${payment.currency}` },
    { label: t("detail.reference"), value: payment.paymentReference, mono: true },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--dalily-navy)]">{t("detail.businessInfo")}</h2>
          <Badge variant="secondary">{t(`status.${payment.paymentStatus}`)}</Badge>
        </div>

        <dl className="space-y-3">
          {infoRows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0">
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {row.label}
              </dt>
              <dd
                className={
                  row.mono
                    ? "break-all font-mono text-sm font-semibold text-[var(--dalily-navy)]"
                    : "truncate text-sm font-medium text-[var(--dalily-navy)]"
                }
                title={String(row.value)}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div>
          <h3 className="text-sm font-bold text-[var(--dalily-navy)]">{t("detail.timeline")}</h3>
          <ol className="mt-3 space-y-3">
            {(payment.events.length > 0
              ? payment.events
              : [
                  {
                    id: "requested",
                    eventType: "requested",
                    actorName: null,
                    note: null,
                    createdAt: payment.createdAt,
                  },
                ]
            ).map((event, index, arr) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 size-2.5 rounded-full",
                      event.eventType === "approved"
                        ? "bg-emerald-500"
                        : event.eventType === "rejected"
                          ? "bg-rose-500"
                          : "bg-[var(--dalily-gold)]",
                    )}
                  />
                  {index < arr.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-semibold text-[var(--dalily-navy)]">
                    {t(`timeline.${event.eventType}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString(locale)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                  {event.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Button asChild variant="ghost" className="w-full">
          <Link href="/admin/payments">{t("detail.back")}</Link>
        </Button>
      </section>

      <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[var(--dalily-navy)]">{t("detail.receipt")}</h2>

        {payment.receiptUrl ? (
          payment.receiptMimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payment.receiptUrl}
              alt={t("detail.receipt")}
              className="max-h-[420px] w-full rounded-xl border object-contain bg-muted/30"
            />
          ) : (
            <iframe
              title={t("detail.receipt")}
              src={payment.receiptUrl}
              className="h-[420px] w-full rounded-xl border bg-muted/30"
            />
          )
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
            {t("noReceipt")}
          </div>
        )}

        {payment.receiptUrl ? (
          <Button asChild variant="outline" className="h-12 w-full rounded-2xl">
            <a href={payment.receiptUrl} target="_blank" rel="noreferrer">
              {t("detail.openReceipt")}
            </a>
          </Button>
        ) : null}

        {canDecide ? (
          <div className="grid gap-3 border-t pt-5 sm:grid-cols-2">
            <Button
              type="button"
              disabled={pending}
              className="h-12 rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              onClick={() => setDialog("approve")}
            >
              <CheckCircle2 className="size-4" />
              {t("approve")}
            </Button>
            <Button
              type="button"
              disabled={pending}
              variant="destructive"
              className="h-12 rounded-2xl font-bold"
              onClick={() => setDialog("reject")}
            >
              <XCircle className="size-4" />
              {t("reject")}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl sm:p-6"
          >
            {dialog === "approve" ? (
              <>
                <h3 className="text-lg font-bold text-[var(--dalily-navy)]">{t("dialogs.approveTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">
                  {t("dialogs.approveBody")}
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl"
                    disabled={pending}
                    onClick={() => setDialog(null)}
                  >
                    {t("dialogs.cancel")}
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                    disabled={pending}
                    onClick={() => run(() => approvePaymentAction(payment.id))}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("dialogs.confirmApprove")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-[var(--dalily-navy)]">{t("dialogs.rejectTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">{t("dialogs.rejectBody")}</p>
                <label className="mt-4 block text-sm font-medium text-[var(--dalily-navy)]">
                  {t("detail.rejectNote")}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    placeholder={t("detail.rejectNotePlaceholder")}
                  />
                </label>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl"
                    disabled={pending}
                    onClick={() => setDialog(null)}
                  >
                    {t("dialogs.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-11 rounded-2xl font-bold"
                    disabled={pending}
                    onClick={() => run(() => rejectPaymentAction(payment.id, note))}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("dialogs.confirmReject")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
