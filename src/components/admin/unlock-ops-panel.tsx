"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnlockOpsOverview } from "@/domains/admin/unlock-ops";
import {
  approveUnlockQueuePaymentAction,
  rejectUnlockQueuePaymentAction,
  compUnlockSessionAction,
} from "@/actions/admin-ops.actions";

export function UnlockOpsPanel({ overview }: { overview: UnlockOpsOverview }) {
  const t = useTranslations("admin.unlockOps");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ success: boolean }>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("pendingPayments")}</h2>
        {overview.pendingPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPendingPayments")}</p>
        ) : (
          <ul className="space-y-2">
            {overview.pendingPayments.map((p) => (
              <li
                key={p.paymentId}
                className="flex flex-col gap-2 rounded-2xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">{p.providerName ?? p.providerId}</p>
                  <p className="text-muted-foreground">
                    {p.amount} {p.currency} · {p.paymentStatus}
                    {p.slaDeadline
                      ? ` · SLA ${new Date(p.slaDeadline).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => approveUnlockQueuePaymentAction(p.paymentId))}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => run(() => rejectUnlockQueuePaymentAction(p.paymentId))}
                  >
                    {t("reject")}
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/payments/${p.paymentId}`}>{t("paymentDetail")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("openSessions")}</h2>
        {overview.openSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noOpenSessions")}</p>
        ) : (
          <ul className="space-y-3">
            {overview.openSessions.map((s) => (
              <li key={s.id} className="rounded-2xl border border-border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.status}</p>
                    <p className="text-muted-foreground">
                      SLA {new Date(s.slaDeadline).toLocaleString()} · {s.feeAmount}{" "}
                      {s.feeCurrency}
                    </p>
                    <Link
                      href={`/admin/inspect?requestId=${s.serviceRequestId}`}
                      className="text-xs underline"
                    >
                      {t("inspectRequest")}
                    </Link>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <Label htmlFor={`reason-${s.id}`}>{t("compReason")}</Label>
                  <Input
                    id={`reason-${s.id}`}
                    name={`reason-${s.id}`}
                    required
                    minLength={8}
                    placeholder={t("compReasonPlaceholder")}
                    className="max-w-lg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      const el = document.getElementById(
                        `reason-${s.id}`,
                      ) as HTMLInputElement | null;
                      const reason = el?.value?.trim() ?? "";
                      const fd = new FormData();
                      fd.set("sessionId", s.id);
                      fd.set("reason", reason);
                      run(() => compUnlockSessionAction(fd));
                    }}
                  >
                    {t("compUnlock")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("timedOut")}</h2>
        {overview.timedOutRecent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTimedOut")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {overview.timedOutRecent.map((s) => (
              <li key={s.id} className="rounded-xl border border-border px-3 py-2">
                <Link href={`/admin/inspect?requestId=${s.serviceRequestId}`} className="underline">
                  {s.serviceRequestId.slice(0, 8)}…
                </Link>{" "}
                <span className="text-muted-foreground">
                  {s.closedAt ? new Date(s.closedAt).toLocaleString() : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
