"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveProviderAutomationSettingsAction } from "@/actions/automation.actions";
import type { ProviderAutomationSettings } from "@/lib/ai/automation/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ProviderAutomationSettingsForm({
  settings,
}: {
  settings: ProviderAutomationSettings;
}) {
  const t = useTranslations("automation.providerSettings");
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await saveProviderAutomationSettingsAction(fd);
        });
      }}
    >
      <div>
        <p className="text-sm font-semibold">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      {(
        [
          ["autoAcceptEnabled", "autoAccept", settings.autoAcceptEnabled],
          [
            "autoRejectOutOfArea",
            "autoRejectArea",
            settings.autoRejectOutOfArea,
          ],
          [
            "autoRejectOutsideHours",
            "autoRejectHours",
            settings.autoRejectOutsideHours,
          ],
          [
            "suggestRouteOptimization",
            "routeOpt",
            settings.suggestRouteOptimization,
          ],
          ["suggestScheduleGaps", "scheduleGaps", settings.suggestScheduleGaps],
        ] as const
      ).map(([name, key, checked]) => (
        <div key={name} className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor={name}>{t(key)}</Label>
            <p className="text-xs text-muted-foreground">{t(`${key}Hint`)}</p>
          </div>
          <input
            id={name}
            name={name}
            type="checkbox"
            defaultChecked={checked}
            value="true"
            className="size-5 rounded border"
          />
        </div>
      ))}

      <p className="text-[0.7rem] text-muted-foreground">{t("safetyNote")}</p>

      <Button type="submit" className="w-full rounded-2xl" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
