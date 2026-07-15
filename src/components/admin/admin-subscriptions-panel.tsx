"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  approvePaymentAction,
  cancelSubscriptionAdminAction,
  changePlanAdminAction,
  extendSubscriptionAction,
  rejectPaymentAction,
} from "@/actions/admin-subscription.actions";
import { getLocalizedField } from "@/types/provider.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdminSubscriptionsPanelProps = {
  subscriptions: {
    id: string;
    providerId: string;
    providerName: { ar: string; en: string };
    planSlug: string;
    status: string;
    expiresAt: string | null;
  }[];
  payments: {
    id: string;
    providerId: string;
    providerName: { ar: string; en: string };
    amount: number;
    currency: string;
    paymentStatus: string;
    createdAt: string;
  }[];
};

export function AdminSubscriptionsPanel({ subscriptions, payments }: AdminSubscriptionsPanelProps) {
  const t = useTranslations("admin.subscriptions");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("paymentsTitle")}</h2>
        {payments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">{t("noPayments")}</CardContent>
          </Card>
        ) : (
          payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{getLocalizedField(payment.providerName, locale)}</p>
                  <p className="text-sm text-muted-foreground">
                    ${payment.amount} {payment.currency} · {new Date(payment.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`paymentStatus.${payment.paymentStatus}`)}</Badge>
                  {payment.paymentStatus === "pending" || payment.paymentStatus === "pending_review" ? (
                    <>
                      <Button size="sm" disabled={pending} onClick={() => run(() => approvePaymentAction(payment.id))}>
                        {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => run(() => rejectPaymentAction(payment.id))}
                      >
                        <XCircle className="size-4" />
                        {t("reject")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("subscriptionsTitle")}</h2>
        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">{t("empty")}</CardContent>
          </Card>
        ) : (
          subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">{getLocalizedField(sub.providerName, locale)}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t(`plans.${sub.planSlug}`)} · {t(`status.${sub.status}`)}
                  </p>
                </div>
                {sub.expiresAt ? (
                  <span className="text-xs text-muted-foreground">
                    {new Date(sub.expiresAt).toLocaleDateString(locale)}
                  </span>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => changePlanAdminAction(sub.providerId, "pro"))}
                >
                  {t("setPro")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => changePlanAdminAction(sub.providerId, "premium"))}
                >
                  {t("setPremium")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => extendSubscriptionAction(sub.providerId, 30))}
                >
                  {t("extend30")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => cancelSubscriptionAdminAction(sub.providerId))}
                >
                  {t("cancel")}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
