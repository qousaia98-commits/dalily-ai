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
  type PaymentInstructionsData,
} from "@/actions/subscription.actions";
import {
  marketingToPlanSlug,
  SubscriptionPlanCards,
  type MarketingPlanId,
} from "@/components/business/subscription-plan-cards";
import { SubscriptionPaymentPanel } from "@/components/business/subscription-payment-panel";
import { SubscriptionUpgradeSummary } from "@/components/business/subscription-upgrade-summary";
import { SubscriptionFaq } from "@/components/business/subscription-faq";
import { PlanBadge } from "@/components/shared/plan-badge";
import type { PlanSlug } from "@/lib/subscription/types";
import { formatDate } from "@/lib/format/datetime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BusinessSubscriptionPanelProps = {
  currentPlanSlug: PlanSlug;
  status: string;
  expiresAt: string | null;
  pendingPayment: PaymentInstructionsData | null;
  payments: {
    id: string;
    amount: number;
    currency: string;
    paymentStatus: string;
    paymentReference?: string;
    createdAt: string;
  }[];
  mode?: "upgrade" | "welcome";
  onStarterContinue?: () => void;
  /** When false, FAQ is rendered by the parent page (server). */
  showFaq?: boolean;
};

export function BusinessSubscriptionPanel({
  currentPlanSlug,
  status,
  expiresAt,
  pendingPayment,
  payments,
  mode = "upgrade",
  onStarterContinue,
  showFaq = true,
}: BusinessSubscriptionPanelProps) {
  const t = useTranslations("business.subscription");
  const locale = useLocale();
  const router = useRouter();
  const localeRouter = useLocaleRouter();
  const [pending, startTransition] = useTransition();
  const [liveInstructions, setLiveInstructions] = useState<PaymentInstructionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryPlan, setSummaryPlan] = useState<Extract<MarketingPlanId, "pro" | "premium"> | null>(
    null,
  );
  const [downgradeConfirm, setDowngradeConfirm] = useState(false);

  const instructions = liveInstructions ?? pendingPayment;
  const showPayment =
    Boolean(instructions) && (status === "pending_payment" || Boolean(liveInstructions));

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function handleSelectPlan(planId: MarketingPlanId) {
    setError(null);

    if (planId === "starter") {
      // Welcome flow: choosing Free continues onboarding.
      if (mode === "welcome") {
        if (onStarterContinue) onStarterContinue();
        else localeRouter.push("/business");
        return;
      }

      // Already on Free — nothing to do (CTA should not show).
      if (currentPlanSlug === "free") return;

      // Paid → Free is a downgrade: stay on page and ask for confirmation.
      setDowngradeConfirm(true);
      return;
    }

    // Do NOT open payment immediately — show upgrade summary first.
    setSummaryPlan(planId);
  }

  function confirmDowngrade() {
    setError(null);
    startTransition(async () => {
      const result = await downgradeSubscriptionAction();
      if (!result.success) {
        setError(t("errors.downgradeFailed"));
        return;
      }
      setDowngradeConfirm(false);
      router.refresh();
    });
  }

  function confirmUpgrade() {
    if (!summaryPlan) return;
    setError(null);

    startTransition(async () => {
      const result = await upgradeSubscriptionAction(marketingToPlanSlug(summaryPlan));
      if (!result.success) {
        setError(
          result.error === "provider_not_approved"
            ? t("errors.notApproved")
            : result.error === "payment_pending"
              ? t("errors.paymentPending")
              : result.error === "payment_not_configured"
                ? t("errors.paymentNotConfigured")
                : t("errors.upgradeFailed"),
        );
        return;
      }
      setSummaryPlan(null);
      if (result.paymentInstructions) {
        setLiveInstructions(result.paymentInstructions);
      }
      router.refresh();
    });
  }

  if (showPayment && instructions) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-0">
        <SubscriptionPaymentPanel
          instructions={instructions}
          onBack={
            mode === "welcome"
              ? undefined
              : () => {
                  setLiveInstructions(null);
                }
          }
        />
      </div>
    );
  }

  if (summaryPlan) {
    return (
      <div className="space-y-6">
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <SubscriptionUpgradeSummary
          planId={summaryPlan}
          pending={pending}
          onContinue={confirmUpgrade}
          onBack={() => {
            setSummaryPlan(null);
            setError(null);
          }}
        />
      </div>
    );
  }

  if (downgradeConfirm) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-5 rounded-3xl border border-[#E8ECF2] bg-white p-6 shadow-[0_12px_40px_-20px_rgba(11,21,38,0.18)] sm:p-8">
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <div className="space-y-2 text-center sm:text-start">
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
            {t("downgradeConfirm.eyebrow")}
          </p>
          <h2 className="text-xl font-bold text-[var(--dalily-navy)] sm:text-2xl">
            {t("downgradeConfirm.title")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("downgradeConfirm.body")}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-2xl"
            disabled={pending}
            onClick={() => {
              setDowngradeConfirm(false);
              setError(null);
            }}
          >
            {t("downgradeConfirm.cancel")}
          </Button>
          <Button
            type="button"
            className="min-h-11 rounded-2xl"
            disabled={pending}
            onClick={confirmDowngrade}
          >
            {pending ? t("downgradeConfirm.working") : t("downgradeConfirm.confirm")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-10 overflow-x-hidden sm:space-y-12">
      {mode === "upgrade" ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-[#E8ECF2] bg-white/80 px-5 py-5 text-center shadow-[0_10px_30px_-20px_rgba(11,21,38,0.2)] sm:flex-row sm:justify-between sm:text-start">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("currentPlan")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <PlanBadge
                planSlug={currentPlanSlug}
                label={t(`plans.${currentPlanSlug === "free" ? "starter" : currentPlanSlug}.name`)}
              />
              <Badge variant="secondary">{t(`status.${status}`)}</Badge>
            </div>
            {expiresAt ? (
              <p className="text-sm text-muted-foreground">
                {t("expiresAt", { date: formatDate(expiresAt, locale) })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noExpiration")}</p>
            )}
          </div>
          {currentPlanSlug !== "free" && status === "active" ? (
            <div className="flex flex-wrap justify-center gap-2">
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
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
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

      {showFaq ? <SubscriptionFaq /> : null}

      {mode === "upgrade" && payments.length > 0 ? (
        <section className="mx-auto w-full max-w-2xl space-y-4" aria-labelledby="payment-history-title">
          <h2 id="payment-history-title" className="text-lg font-bold text-[var(--dalily-navy)]">
            {t("paymentHistory")}
          </h2>
          <ul className="space-y-3">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8ECF2] bg-white px-4 py-3.5 text-sm shadow-sm"
              >
                <span className="font-semibold text-[var(--dalily-navy)]">
                  ${payment.amount} {payment.currency}
                </span>
                {payment.paymentReference ? (
                  <span className="font-mono text-xs text-muted-foreground">{payment.paymentReference}</span>
                ) : null}
                <Badge variant="secondary">{t(`paymentStatus.${payment.paymentStatus}`)}</Badge>
                <span className="text-muted-foreground">
                  {formatDate(payment.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
