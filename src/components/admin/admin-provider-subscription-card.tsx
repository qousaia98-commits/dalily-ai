"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  approvePaymentAction,
  rejectPaymentAction,
} from "@/actions/admin-payment.actions";
import type { AdminProviderOpenPayment } from "@/lib/admin/queries";
import { PlanBadge } from "@/components/shared/plan-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanSlug } from "@/lib/subscription/types";

type AdminProviderSubscriptionCardProps = {
  currentPlanSlug: string;
  openPayment: AdminProviderOpenPayment | null;
};

export function AdminProviderSubscriptionCard({
  currentPlanSlug,
  openPayment,
}: AdminProviderSubscriptionCardProps) {
  const t = useTranslations("admin.providers.subscription");
  const tPlans = useTranslations("admin.payments.plans");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const planLabel =
    currentPlanSlug === "free"
      ? t("starter")
      : currentPlanSlug === "premium"
        ? tPlans("premium")
        : tPlans("pro");

  const requestedLabel =
    openPayment?.planSlug === "premium" ? tPlans("premium") : tPlans("pro");

  const canDecide =
    openPayment &&
    (openPayment.paymentStatus === "pending" ||
      openPayment.paymentStatus === "pending_review");

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(t("actionFailed"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("currentPlan")}</span>
          <PlanBadge planSlug={currentPlanSlug as PlanSlug} label={planLabel} />
        </div>

        {!openPayment ? (
          <p className="text-sm text-muted-foreground">{t("noRequest")}</p>
        ) : (
          <div className="space-y-4 rounded-2xl border border-[color-mix(in_oklab,var(--dalily-gold)_30%,transparent)] bg-[color-mix(in_oklab,var(--dalily-gold)_8%,transparent)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{t("requestedPlan")}</span>
              <PlanBadge
                planSlug={openPayment.planSlug as PlanSlug}
                label={requestedLabel}
              />
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("amount")}</dt>
                <dd className="font-medium">
                  {openPayment.amount} {openPayment.currency}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("reference")}</dt>
                <dd className="font-mono text-xs">{openPayment.paymentReference}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("status")}</dt>
                <dd className="font-medium">{t(`paymentStatus.${openPayment.paymentStatus}`)}</dd>
              </div>
            </dl>

            {openPayment.receiptUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("receipt")}</p>
                {openPayment.receiptMimeType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={openPayment.receiptUrl}
                    alt={t("receipt")}
                    className="max-h-64 w-full max-w-sm rounded-xl border object-contain bg-muted"
                  />
                ) : (
                  <a
                    href={openPayment.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-[var(--dalily-gold)] underline"
                  >
                    {t("viewReceipt")}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noReceipt")}</p>
            )}

            {canDecide ? (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">{t("rejectNote")}</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending}
                    className="gap-2"
                    onClick={() => run(() => approvePaymentAction(openPayment.id))}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {openPayment.planSlug === "premium"
                      ? t("approvePremium")
                      : t("approvePro")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    className="gap-2"
                    onClick={() => run(() => rejectPaymentAction(openPayment.id, note))}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    {t("reject")}
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
