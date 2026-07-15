"use client";

import { Building2, CreditCard, Hash, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export type PaymentInstructions = {
  receiver: string;
  account: string;
  amount: number;
  currency: string;
  reference: string;
};

type SubscriptionPaymentPanelProps = {
  instructions: PaymentInstructions;
  planLabel: string;
  onBack?: () => void;
};

export function SubscriptionPaymentPanel({
  instructions,
  planLabel,
  onBack,
}: SubscriptionPaymentPanelProps) {
  const t = useTranslations("business.subscription.payment");

  const rows = [
    {
      icon: Building2,
      label: t("receiver"),
      value: instructions.receiver || t("receiverFallback"),
    },
    {
      icon: CreditCard,
      label: t("account"),
      value: instructions.account || t("accountFallback"),
    },
    {
      icon: Hash,
      label: t("reference"),
      value: instructions.reference,
    },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
      <div className="rounded-3xl border border-[var(--dalily-gold)]/40 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)] p-8 shadow-[0_16px_40px_-20px_rgba(11,21,38,0.25)]">
        <p className="text-xs font-bold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
          {t("stepLabel")}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">{t("subtitle", { plan: planLabel })}</p>

        <div className="mt-8 rounded-2xl bg-[var(--dalily-navy)] px-6 py-5 text-center text-white">
          <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">{t("amountLabel")}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            ${instructions.amount}{" "}
            <span className="text-base font-medium text-white/70">{instructions.currency}</span>
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <li
              key={label}
              className="flex items-start gap-3 rounded-2xl border border-[#E8ECF2] bg-white px-4 py-3.5"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="mt-0.5 break-all font-semibold text-[var(--dalily-navy)]">{value}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border border-dashed border-[var(--dalily-gold)]/50 bg-white/70 px-4 py-4 text-sm leading-relaxed text-[#5C6478]">
          {t("instructions")}
        </div>
      </div>

      <div className="rounded-3xl border border-[#E8ECF2] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-[var(--dalily-navy)]">{t("waitingTitle")}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">{t("waitingBody")}</p>
        {onBack ? (
          <Button type="button" variant="ghost" className="mt-4" onClick={onBack}>
            {t("backToPlans")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
