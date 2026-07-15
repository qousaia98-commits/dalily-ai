"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRouter as useLocaleRouter } from "@/lib/i18n/routing";
import {
  cancelSubscriptionAction,
  downgradeSubscriptionAction,
  renewSubscriptionAction,
  upgradeSubscriptionAction,
} from "@/actions/subscription.actions";
import {
  marketingToPlanSlug,
  SubscriptionPlanCards,
  type MarketingPlanId,
} from "@/components/business/subscription-plan-cards";
import {
  SubscriptionPaymentPanel,
  type PaymentInstructions,
} from "@/components/business/subscription-payment-panel";
import type { PlanSlug } from "@/lib/subscription/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BusinessSubscriptionPanelProps = {
  currentPlanSlug: PlanSlug;
  status: string;
  expiresAt: string | null;
  pendingPayment: PaymentInstructions | null;
  payments: {
    id: string;
    amount: number;
    currency: string;
    paymentStatus: string;
    createdAt: string;
  }[];
  mode?: "upgrade" | "welcome";
  onStarterContinue?: () => void;
};

export function BusinessSubscriptionPanel({
  currentPlanSlug,
  status,
  expiresAt,
  pendingPayment,
  payments,
  mode = "upgrade",
  onStarterContinue,
}: BusinessSubscriptionPanelProps) {
  const t = useTranslations("business.subscription");
  const locale = useLocale();
  const router = useRouter();
  const localeRouter = useLocaleRouter();
  const [pending, startTransition] = useTransition();
  const [liveInstructions, setLiveInstructions] = useState<PaymentInstructions | null>(null);
  const [selectedPaidPlan, setSelectedPaidPlan] = useState<"pro" | "premium" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const instructions = liveInstructions ?? pendingPayment;
  const showPayment = Boolean(instructions) && (status === "pending_payment" || Boolean(liveInstructions));

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function handleSelectPlan(planId: MarketingPlanId) {
    setError(null);

    if (planId === "starter") {
      if (mode === "welcome") {
        if (onStarterContinue) onStarterContinue();
        else localeRouter.push("/business");
      }
      return;
    }

    setSelectedPaidPlan(planId);
    startTransition(async () => {
      const result = await upgradeSubscriptionAction(marketingToPlanSlug(planId));
      if (!result.success) {
        setError(t("errors.upgradeFailed"));
        setSelectedPaidPlan(null);
        return;
      }
      if (result.paymentInstructions) {
        setLiveInstructions(result.paymentInstructions);
      }
      router.refresh();
    });
  }

  if (showPayment && instructions) {
    const planLabel =
      selectedPaidPlan === "premium" || currentPlanSlug === "premium"
        ? t("plans.premium.name")
        : t("plans.pro.name");

    return (
      <div className="space-y-8">
        <SubscriptionPaymentPanel
          instructions={instructions}
          planLabel={planLabel}
          onBack={
            mode === "welcome"
              ? undefined
              : () => {
                  setLiveInstructions(null);
                  setSelectedPaidPlan(null);
                }
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {mode === "upgrade" ? (
        <Card className="rounded-3xl border-[#E8ECF2] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[var(--dalily-navy)]">{t("currentPlan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[var(--dalily-navy)] text-white hover:bg-[var(--dalily-navy)]">
                {t(`plans.${currentPlanSlug === "free" ? "starter" : currentPlanSlug}.name`)}
              </Badge>
              <Badge variant="secondary">{t(`status.${status}`)}</Badge>
            </div>
            {expiresAt ? (
              <p className="text-sm text-muted-foreground">
                {t("expiresAt", { date: new Date(expiresAt).toLocaleDateString(locale) })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noExpiration")}</p>
            )}
            {currentPlanSlug !== "free" && status === "active" ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(renewSubscriptionAction)}>
                  {t("renew")}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(downgradeSubscriptionAction)}>
                  {t("downgrade")}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(cancelSubscriptionAction)}>
                  {t("cancel")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <SubscriptionPlanCards
        currentPlanSlug={currentPlanSlug}
        status={status}
        pending={pending}
        mode={mode}
        onSelectPlan={handleSelectPlan}
      />

      {mode === "upgrade" ? (
        <Card className="rounded-3xl border-[#E8ECF2] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[var(--dalily-navy)]">{t("paymentHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      ${payment.amount} {payment.currency}
                    </span>
                    <Badge variant="secondary">{t(`paymentStatus.${payment.paymentStatus}`)}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString(locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
