"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MonetizationBillingSettings } from "@/lib/monetization";
import { saveAdminBillingSettingsAction } from "@/actions/monetization.actions";

export function AdminMonetizationSettingsForm({
  initial,
}: {
  initial: MonetizationBillingSettings;
}) {
  const t = useTranslations("monetization.admin");
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);

  function setNum<K extends keyof MonetizationBillingSettings>(
    key: K,
    value: string,
  ) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setForm((prev) => ({ ...prev, [key]: n }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveAdminBillingSettingsAction({
            businessPriceUsd: form.businessPriceUsd,
            includedUnlocks: form.includedUnlocks,
            minLeadPriceUsd: form.minLeadPriceUsd,
            maxLeadPriceUsd: form.maxLeadPriceUsd,
            baseLeadPriceUsd: form.baseLeadPriceUsd,
            emergencyMultiplier: form.emergencyMultiplier,
            urgencyMultiplier: form.urgencyMultiplier,
            multiServiceMultiplier: form.multiServiceMultiplier,
            complexityMultiplier: form.complexityMultiplier,
            distanceMultiplierPerKm: form.distanceMultiplierPerKm,
            demandMultiplier: form.demandMultiplier,
            categoryMultipliers: form.categoryMultipliers,
            currency: form.currency,
          });
          if (!result.ok) toast.error(t("saveError"));
          else {
            setForm(result.settings);
            toast.success(t("saved"));
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["businessPriceUsd", t("businessPrice")],
            ["includedUnlocks", t("includedUnlocks")],
            ["minLeadPriceUsd", t("minLead")],
            ["maxLeadPriceUsd", t("maxLead")],
            ["baseLeadPriceUsd", t("baseLead")],
            ["emergencyMultiplier", t("emergencyMul")],
            ["urgencyMultiplier", t("urgencyMul")],
            ["multiServiceMultiplier", t("multiMul")],
            ["complexityMultiplier", t("complexityMul")],
            ["distanceMultiplierPerKm", t("distanceMul")],
            ["demandMultiplier", t("demandMul")],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="space-y-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="number"
              step="any"
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
              value={Number(form[key])}
              onChange={(e) => setNum(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
