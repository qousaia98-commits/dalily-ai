"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveCompanyBillingSettingsAction } from "@/actions/financial-documents.actions";
import type { CompanyBillingSettings } from "@/lib/financial-documents";

export function CompanyBillingSettingsForm({
  initial,
}: {
  initial: CompanyBillingSettings;
}) {
  const t = useTranslations("admin.companyBilling");
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();

  function field(
    key: keyof Omit<CompanyBillingSettings, "id" | "defaultTaxRate">,
    label: string,
  ) {
    return (
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <input
          className="h-11 w-full rounded-2xl border border-border bg-card px-3"
          value={settings[key] ?? ""}
          onChange={(e) =>
            setSettings((s) => ({ ...s, [key]: e.target.value }))
          }
        />
      </label>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const { id: _id, ...patch } = settings;
          void _id;
          const result = await saveCompanyBillingSettingsAction(patch);
          if (!result.ok) toast.error(t("saveError"));
          else {
            setSettings(result.settings);
            toast.success(t("saved"));
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field("companyName", t("companyName"))}
        {field("companyAddress", t("companyAddress"))}
        {field("country", t("country"))}
        {field("vatNumber", t("vatNumber"))}
        {field("taxId", t("taxId"))}
        {field("supportEmail", t("supportEmail"))}
        {field("website", t("website"))}
        {field("phone", t("phone"))}
        {field("currency", t("currency"))}
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t("taxRate")}</span>
          <input
            type="number"
            step="0.0001"
            min="0"
            className="h-11 w-full rounded-2xl border border-border bg-card px-3"
            value={settings.defaultTaxRate}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                defaultTaxRate: Number(e.target.value),
              }))
            }
          />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t("invoiceFooter")}</span>
        <textarea
          className="min-h-20 w-full rounded-2xl border border-border bg-card px-3 py-2"
          value={settings.invoiceFooter}
          onChange={(e) =>
            setSettings((s) => ({ ...s, invoiceFooter: e.target.value }))
          }
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t("legalNotice")}</span>
        <textarea
          className="min-h-20 w-full rounded-2xl border border-border bg-card px-3 py-2"
          value={settings.legalNotice}
          onChange={(e) =>
            setSettings((s) => ({ ...s, legalNotice: e.target.value }))
          }
        />
      </label>
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
