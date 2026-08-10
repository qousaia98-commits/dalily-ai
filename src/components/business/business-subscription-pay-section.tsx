/**
 * Flat $5/mo Business subscription payment — start / upload receipt.
 * Reuses SubscriptionPaymentPanel + business_subscription payment rail.
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  renewBusinessPlanAction,
  upgradeBusinessPlanAction,
} from "@/actions/monetization.actions";
import { SubscriptionPaymentPanel } from "@/components/business/subscription-payment-panel";
import type { PaymentInstructionsData } from "@/actions/subscription.actions";
import { Link } from "@/lib/i18n/navigation";

export type SubscriptionPendingPayment = {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  hasReceipt: boolean;
  receiver: string;
  account: string;
  swift?: string;
  bankName?: string;
  checkoutUrl?: string;
};

function toInstructions(
  p: SubscriptionPendingPayment,
  label: string,
): PaymentInstructionsData {
  return {
    paymentId: p.paymentId,
    planSlug: "pro",
    planLabel: label,
    receiver: p.receiver,
    account: p.account,
    swift: p.swift,
    bankName: p.bankName,
    amount: p.amount,
    currency: p.currency,
    reference: p.reference,
    status: p.status,
    hasReceipt: p.hasReceipt,
  };
}

type Props = {
  priceUsd: number;
  /** unpaid → new; grace/hidden/renewing → renewal idempotency key */
  mode: "new" | "renew";
  pendingPayment?: SubscriptionPendingPayment | null;
};

export function BusinessSubscriptionPaySection({
  priceUsd,
  mode,
  pendingPayment = null,
}: Props) {
  const t = useTranslations("businessSubscription");
  const [pending, startTransition] = useTransition();
  const [checkout, setCheckout] = useState<SubscriptionPendingPayment | null>(
    pendingPayment?.checkoutUrl ? null : pendingPayment,
  );

  const instructions = useMemo(
    () => (checkout ? toInstructions(checkout, t("planLabel")) : null),
    [checkout, t],
  );

  if (instructions) {
    return (
      <section className="relative space-y-4">
        <SubscriptionPaymentPanel
          instructions={instructions}
          onBack={() => setCheckout(null)}
        />
      </section>
    );
  }

  return (
    <section className="relative space-y-3 rounded-3xl border border-[var(--dalily-gold)]/40 bg-card/80 p-5 sm:p-6">
      <h2 className="text-base font-semibold">{t("paymentTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("paymentBody", { price: priceUsd })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="rounded-xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              if (mode === "renew") {
                const result = await renewBusinessPlanAction();
                if (!result.success) {
                  toast.error(t("paymentStartError"));
                  return;
                }
                if (result.payment) {
                  setCheckout(result.payment);
                  toast.success(t("paymentStarted"));
                  return;
                }
                toast.error(t("paymentStartError"));
                return;
              }

              const result = await upgradeBusinessPlanAction();
              if (!result.success) {
                toast.error(t("paymentStartError"));
                return;
              }
              if (result.checkoutUrl) {
                window.location.href = result.checkoutUrl;
                return;
              }
              if (result.payment) {
                setCheckout(result.payment);
                toast.success(t("paymentStarted"));
                return;
              }
              toast.error(t("paymentStartError"));
            });
          }}
        >
          {mode === "renew"
            ? t("renewCta", { price: priceUsd })
            : t("payCta", { price: priceUsd })}
        </Button>
        {pendingPayment?.checkoutUrl ? (
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() => {
              window.location.href = pendingPayment.checkoutUrl!;
            }}
          >
            {t("resumeCheckout")}
          </Button>
        ) : null}
        <Button asChild variant="ghost" className="rounded-xl">
          <Link href="/business/payments">{t("paymentsHub")}</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-xl">
          <Link href="/business">{t("backHome")}</Link>
        </Button>
      </div>
    </section>
  );
}
