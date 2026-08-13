"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentDetails = {
  amount: string | number;
  currency: string;
  reference: string;
  receiver: string;
  account: string;
  /** Optional plan / context label shown above amount */
  contextLabel?: string | null;
};

type PaymentDetailsCardProps = {
  details: PaymentDetails;
  className?: string;
  compact?: boolean;
};

/**
 * Single premium card with amount emphasis + copyable reference.
 */
export function PaymentDetailsCard({
  details,
  className,
  compact = false,
}: PaymentDetailsCardProps) {
  const t = useTranslations("paymentExperience.details");
  const [copied, setCopied] = useState<"amount" | "reference" | "receiver" | "account" | null>(
    null,
  );

  const amountText = `${details.amount} ${details.currency}`;

  async function copy(field: typeof copied, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied((c) => (c === field ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[0_12px_40px_-20px_rgba(11,21,38,0.28)]",
        className,
      )}
      aria-label={t("ariaLabel")}
    >
      <div
        className={cn(
          "bg-[var(--dalily-navy)] px-5 text-center text-white",
          compact ? "py-5" : "py-7",
        )}
      >
        {details.contextLabel ? (
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
            {details.contextLabel}
          </p>
        ) : (
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">
            {t("amount")}
          </p>
        )}
        <p
          className={cn(
            "mt-2 font-bold tracking-tight tabular-nums",
            compact ? "text-3xl" : "text-4xl sm:text-5xl",
          )}
        >
          {details.amount}
          <span className="ms-2 text-base font-semibold text-[var(--dalily-gold)] sm:text-lg">
            {details.currency}
          </span>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 h-10 min-h-10 rounded-xl bg-white/10 text-white hover:bg-white/15"
          onClick={() => void copy("amount", amountText)}
        >
          {copied === "amount" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied === "amount" ? t("copied") : t("copyAmount")}
        </Button>
      </div>

      <div className="divide-y divide-border/70 px-1">
        <DetailRow
          label={t("reference")}
          value={details.reference}
          mono
          emphasize
          onCopy={() => void copy("reference", details.reference)}
          copied={copied === "reference"}
          copyLabel={copied === "reference" ? t("copied") : t("copy")}
          hint={t("referenceHint")}
        />
        <DetailRow
          label={t("receiver")}
          value={details.receiver}
          onCopy={() => void copy("receiver", details.receiver)}
          copied={copied === "receiver"}
          copyLabel={copied === "receiver" ? t("copied") : t("copy")}
        />
        <DetailRow
          label={t("account")}
          value={details.account}
          mono
          onCopy={() => void copy("account", details.account)}
          copied={copied === "account"}
          copyLabel={copied === "account" ? t("copied") : t("copy")}
        />
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono,
  emphasize,
  onCopy,
  copied,
  copyLabel,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: boolean;
  onCopy: () => void;
  copied: boolean;
  copyLabel: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "break-all text-sm font-semibold text-foreground",
            mono && "font-mono tracking-wide",
            emphasize && "text-base font-bold",
          )}
          title={value}
        >
          {value}
        </p>
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 rounded-xl px-3"
        onClick={onCopy}
        aria-label={copyLabel}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        <span className="hidden sm:inline">{copyLabel}</span>
      </Button>
    </div>
  );
}
