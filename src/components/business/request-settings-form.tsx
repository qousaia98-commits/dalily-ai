"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  saveProviderRequestSettingsAction,
  type ServiceRequestActionState,
} from "@/actions/service-request.actions";
import type { ProviderRequestSettings } from "@/lib/service-requests/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ServiceRequestActionState = { success: false };

export function RequestSettingsForm({ settings }: { settings: ProviderRequestSettings }) {
  const t = useTranslations("business.requestSettings");
  const [state, action, pending] = useActionState(saveProviderRequestSettingsAction, initial);

  return (
    <form action={action} className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="acceptingRequests">{t("accepting")}</Label>
          <p className="text-xs text-muted-foreground">{t("acceptingHint")}</p>
        </div>
        <input
          id="acceptingRequests"
          name="acceptingRequests"
          type="checkbox"
          defaultChecked={settings.accepting_requests}
          value="true"
          className="size-5 rounded border"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="vacationMode">{t("vacation")}</Label>
          <p className="text-xs text-muted-foreground">{t("vacationHint")}</p>
        </div>
        <input
          id="vacationMode"
          name="vacationMode"
          type="checkbox"
          defaultChecked={settings.vacation_mode}
          value="true"
          className="size-5 rounded border"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxPendingRequests">{t("maxPending")}</Label>
        <Input
          id="maxPendingRequests"
          name="maxPendingRequests"
          type="number"
          min={1}
          max={200}
          defaultValue={settings.max_pending_requests}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="estimatedResponseHours">{t("responseHours")}</Label>
        <Input
          id="estimatedResponseHours"
          name="estimatedResponseHours"
          type="number"
          min={1}
          max={168}
          defaultValue={settings.estimated_response_hours}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="autoRejectMessage">{t("autoReject")}</Label>
        <Textarea
          id="autoRejectMessage"
          name="autoRejectMessage"
          rows={3}
          defaultValue={settings.auto_reject_message ?? ""}
          className="rounded-xl"
          placeholder={t("autoRejectPlaceholder")}
        />
      </div>

      {state.success ? (
        <p className="text-sm text-emerald-600">{t("saved")}</p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${state.error}` as "errors.settings_failed")}
        </p>
      ) : null}

      <Button type="submit" className="w-full rounded-2xl" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
