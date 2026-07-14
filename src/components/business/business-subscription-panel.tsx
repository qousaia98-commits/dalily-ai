"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import {
  cancelSubscriptionAction,
  downgradeSubscriptionAction,
  renewSubscriptionAction,
  upgradeSubscriptionAction,
} from "@/actions/subscription.actions";
import type { SubscriptionPlanRow } from "@/lib/subscription/types";
import { getLocalizedField } from "@/types/provider.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BusinessSubscriptionPanelProps = {
  currentPlanSlug: string;
  status: string;
  expiresAt: string | null;
  plans: SubscriptionPlanRow[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    paymentStatus: string;
    createdAt: string;
  }[];
};

const FEATURE_KEYS = [
  "maxServices",
  "maxImages",
  "verifiedBadge",
  "advancedAnalytics",
  "featuredSection",
  "premiumBadge",
] as const;

export function BusinessSubscriptionPanel({
  currentPlanSlug,
  status,
  expiresAt,
  plans,
  payments,
}: BusinessSubscriptionPanelProps) {
  const t = useTranslations("business.subscription");
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("currentPlan")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{t(`plans.${currentPlanSlug}`)}</Badge>
            <Badge variant="secondary">{t(`status.${status}`)}</Badge>
          </div>
          {expiresAt ? (
            <p className="text-sm text-muted-foreground">
              {t("expiresAt", { date: new Date(expiresAt).toLocaleDateString(locale) })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noExpiration")}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {currentPlanSlug !== "free" ? (
              <>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(renewSubscriptionAction)}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : t("renew")}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(downgradeSubscriptionAction)}>
                  {t("downgrade")}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(cancelSubscriptionAction)}>
                  {t("cancel")}
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentPlanSlug;
          const Icon = plan.slug === "premium" ? Crown : plan.slug === "pro" ? Sparkles : Check;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-primary" />
                  <CardTitle className="text-lg">{getLocalizedField(plan.name, locale)}</CardTitle>
                </div>
                <p className="text-2xl font-bold">
                  {plan.monthlyPriceUsd > 0 ? `$${plan.monthlyPriceUsd}` : t("freePrice")}
                  {plan.monthlyPriceUsd > 0 ? (
                    <span className="text-sm font-normal text-muted-foreground"> / {t("perMonth")}</span>
                  ) : null}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {plan.features.maxServices === null ? (
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      {t("features.unlimitedServices")}
                    </li>
                  ) : null}
                  {FEATURE_KEYS.map((key) => {
                    const value = plan.features[key as keyof typeof plan.features];
                    if (key === "maxServices") return null;
                    if (!value) return null;
                    return (
                      <li key={key} className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" />
                        {t(`features.${key}`, {
                          value: typeof value === "number" ? value : "",
                        })}
                      </li>
                    );
                  })}
                </ul>
                {!isCurrent && plan.slug !== "free" ? (
                  <Button
                    className="w-full"
                    disabled={pending || status === "pending_payment"}
                    onClick={() => run(() => upgradeSubscriptionAction(plan.slug))}
                  >
                    {t("upgrade")}
                  </Button>
                ) : isCurrent ? (
                  <Badge variant="outline">{t("current")}</Badge>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
          ) : (
            <ul className="space-y-2">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between text-sm">
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
    </div>
  );
}
