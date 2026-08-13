"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localizeChamCashError } from "@/lib/payment/localize-errors";

export type ShamCashTransactionCardProps = {
  disabled?: boolean;
  onVerify: (transactionId: string) => Promise<{ success: boolean; error?: string }>;
  onVerified: () => void;
  onFallbackToReceipt: () => void;
};

/**
 * Cham Cash pay flow — provider pastes the transaction id they got after
 * sending in the Cham Cash app; we verify it automatically. If verification
 * can't confirm it (API unreachable/not configured/mismatch), offer the
 * manual receipt-upload path as a fallback instead of a dead end.
 */
export function ShamCashTransactionCard({
  disabled = false,
  onVerify,
  onVerified,
  onFallbackToReceipt,
}: ShamCashTransactionCardProps) {
  const t = useTranslations("paymentExperience.shamcash");
  const [transactionId, setTransactionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit() {
    const trimmed = transactionId.trim();
    if (!trimmed) {
      setError(t("errors.transaction_id_required"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onVerify(trimmed);
      if (!result.success) {
        setError(localizeChamCashError(t, result.error));
        return;
      }
      onVerified();
    });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card px-5 py-6 shadow-sm">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="shamcash-tx-id" className="text-xs font-medium text-muted-foreground">
          {t("inputLabel")}
        </label>
        <Input
          id="shamcash-tx-id"
          value={transactionId}
          onChange={(e) => {
            setTransactionId(e.target.value);
            setError(null);
          }}
          placeholder={t("inputPlaceholder")}
          disabled={disabled || pending}
          className="h-12 rounded-2xl"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2.5 pt-1">
        <Button
          type="button"
          disabled={disabled || pending || !transactionId.trim()}
          className="h-12 min-h-12 w-full rounded-2xl bg-[var(--dalily-navy)] text-base font-bold text-white shadow-md hover:opacity-95"
          onClick={onSubmit}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? t("verifying") : t("verifyCta")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-2xl"
          onClick={onFallbackToReceipt}
          disabled={pending}
        >
          {t("fallbackToReceipt")}
        </Button>
      </div>
    </section>
  );
}
