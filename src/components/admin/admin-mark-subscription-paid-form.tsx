"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminMarkProviderSubscriptionPaidAction } from "@/actions/monetization.actions";

/**
 * Admin-only override: extend / activate a provider's Business subscription
 * without a receipt (comps, goodwill, refunds). Prefer /admin/payments review.
 */
export function AdminMarkSubscriptionPaidForm() {
  const t = useTranslations("monetization.admin");
  const [pending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState("");
  const [months, setMonths] = useState(1);

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await adminMarkProviderSubscriptionPaidAction({
            providerId: providerId.trim(),
            months,
          });
          if (!result.ok) {
            toast.error(t("markPaidError"));
            return;
          }
          toast.success(t("markPaidSuccess"));
          setProviderId("");
        });
      }}
    >
      <div>
        <h2 className="text-sm font-semibold">{t("markPaidTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("markPaidSubtitle")}</p>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-foreground">{t("providerId")}</span>
        <Input
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          placeholder="uuid"
          required
          className="font-mono text-sm"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-foreground">{t("months")}</span>
        <Input
          type="number"
          min={1}
          max={24}
          value={months}
          onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>
      <Button type="submit" className="rounded-xl" disabled={pending || !providerId.trim()}>
        {t("markPaidCta")}
      </Button>
    </form>
  );
}
