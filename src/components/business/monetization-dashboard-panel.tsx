"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import type { MonetizationDashboard } from "@/lib/monetization";
import { upgradeBusinessPlanAction } from "@/actions/monetization.actions";
import {
  cancelStripeRenewalAction,
  listMyStripeInvoicesAction,
  openStripeBillingPortalAction,
} from "@/actions/stripe.actions";
import { SubscriptionPaymentPanel } from "@/components/business/subscription-payment-panel";
import type { PaymentInstructionsData } from "@/actions/subscription.actions";
import { formatDateTime } from "@/lib/format/datetime";

type PendingPayment = {
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

function toInstructions(p: PendingPayment, label: string): PaymentInstructionsData {
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

export function MonetizationDashboardPanel({
  dashboard,
  pendingPayment = null,
}: {
  dashboard: MonetizationDashboard;
  pendingPayment?: PendingPayment | null;
}) {
  const t = useTranslations("monetization.dashboard");
  const tStripe = useTranslations("stripeBilling");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [checkout, setCheckout] = useState<PendingPayment | null>(
    pendingPayment?.checkoutUrl ? null : pendingPayment,
  );
  const [invoices, setInvoices] = useState<
    Array<{
      id: string;
      number: string | null;
      status: string | null;
      amountPaid: number;
      currency: string;
      hostedInvoiceUrl: string | null;
      created: number;
    }>
  >([]);
  const { plan, usage, monthSpendUsd, unlockedCount, settings } = dashboard;
  const isBusiness = plan.billingMode === "business" && plan.status === "active";
  const isStripe = Boolean(plan.stripeSubscriptionId || plan.stripeCustomerId);

  const instructions = useMemo(
    () => (checkout ? toInstructions(checkout, t("planBusiness")) : null),
    [checkout, t],
  );

  if (instructions && !isBusiness) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
            {t("badge")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{t("upgradePaymentTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("upgradePaymentSubtitle")}</p>
        </header>
        <SubscriptionPaymentPanel
          instructions={instructions}
          onBack={() => setCheckout(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("badge")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("currentPlan")}</p>
          <p className="text-lg font-semibold">
            {isBusiness ? t("planBusiness") : t("planFree")}
            {plan.premiumBadge ? ` · ${t("premiumBadge")}` : ""}
          </p>
          {isBusiness && plan.currentPeriodEnd ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {tStripe("renewal", {
                date: formatDateTime(plan.currentPeriodEnd, locale),
              })}
              {plan.cancelAtPeriodEnd ? ` · ${tStripe("cancelScheduled")}` : ""}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("includedUnlocks")}</p>
          <p className="text-lg font-semibold">
            {isBusiness
              ? t("unlocksRemaining", {
                  remaining: usage.remaining,
                  total: usage.includedAllowance,
                })
              : t("payPerLead")}
          </p>
          {isBusiness ? (
            <p className="text-xs text-muted-foreground">
              {t("usedThisMonth", { count: usage.usedCount })}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("monthSpend")}</p>
          <p className="text-lg font-semibold">
            ${monthSpendUsd.toFixed(2)} {settings.currency}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("unlockedTotal")}</p>
          <p className="text-lg font-semibold">{unlockedCount}</p>
        </div>
      </section>

      {!isBusiness ? (
        <section className="space-y-3 rounded-2xl border border-[var(--dalily-gold)]/40 bg-card p-4">
          <h2 className="font-semibold">{t("upgradeTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("upgradeBody", {
              price: settings.businessPriceUsd,
              unlocks: settings.includedUnlocks,
            })}
          </p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            <li>{t("benefitBadge")}</li>
            <li>{t("benefitSearch")}</li>
            <li>{t("benefitAnalytics")}</li>
            <li>{t("benefitMarketing")}</li>
            <li>{t("benefitAi")}</li>
          </ul>
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await upgradeBusinessPlanAction();
                if (!result.success) {
                  toast.error(t("upgradeError"));
                  return;
                }
                if (result.checkoutUrl) {
                  window.location.href = result.checkoutUrl;
                  return;
                }
                if (result.payment) {
                  setCheckout(result.payment);
                  toast.success(t("upgradePaymentStarted"));
                  return;
                }
                toast.success(t("upgradeSuccess"));
              });
            }}
          >
            {t("upgradeCta", { price: settings.businessPriceUsd })}
          </Button>
          {pendingPayment?.checkoutUrl ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                window.location.href = pendingPayment.checkoutUrl!;
              }}
            >
              {tStripe("resumeCheckout")}
            </Button>
          ) : null}
        </section>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("businessActiveHint", {
              unlocks: settings.includedUnlocks,
              min: settings.minLeadPriceUsd,
              max: settings.maxLeadPriceUsd,
            })}
          </p>
          {isStripe ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await openStripeBillingPortalAction();
                    if (!result.success || !result.url) {
                      toast.error(tStripe("portalError"));
                      return;
                    }
                    window.location.href = result.url;
                  });
                }}
              >
                {tStripe("managePayment")}
              </Button>
              {!plan.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await cancelStripeRenewalAction();
                      if (!result.success) toast.error(tStripe("cancelError"));
                      else toast.success(tStripe("cancelSuccess"));
                    });
                  }}
                >
                  {tStripe("cancelRenewal")}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await listMyStripeInvoicesAction();
                    if (!result.ok) {
                      toast.error(tStripe("invoicesError"));
                      return;
                    }
                    setInvoices(result.invoices);
                  });
                }}
              >
                {tStripe("viewInvoices")}
              </Button>
            </div>
          ) : null}
          {invoices.length > 0 ? (
            <ul className="space-y-2 rounded-2xl border border-border p-3 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between gap-2">
                  <span>
                    {inv.number ?? inv.id} · {inv.status}
                  </span>
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--dalily-gold)] hover:underline"
                    >
                      {tStripe("openInvoice")}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/business/unlock">{t("viewUnlocks")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/business/payments/history">{t("viewHistory")}</Link>
        </Button>
      </div>
    </div>
  );
}
