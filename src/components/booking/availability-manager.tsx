"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { saveAvailabilitySettingsAction, blockTimeAction } from "@/actions/booking.actions";
import type { AvailabilitySettings } from "@/lib/booking/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  settings: AvailabilitySettings;
};

export function AvailabilityManager({ settings }: Props) {
  const t = useTranslations("booking.availability");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-3xl border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            await saveAvailabilitySettingsAction(fd);
            router.refresh();
          });
        }}
      >
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="timezone">{t("timezone")}</Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={settings.timezone}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slotDurations">{t("durations")}</Label>
            <Input
              id="slotDurations"
              name="slotDurations"
              defaultValue={settings.slotDurations.join(",")}
              className="h-11 rounded-xl"
              placeholder="30,60,90"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bufferMinutes">{t("buffer")}</Label>
            <Input
              id="bufferMinutes"
              name="bufferMinutes"
              type="number"
              min={0}
              max={120}
              defaultValue={settings.bufferMinutes}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minNoticeHours">{t("notice")}</Label>
            <Input
              id="minNoticeHours"
              name="minNoticeHours"
              type="number"
              min={0}
              defaultValue={settings.minNoticeHours}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxDaysAhead">{t("ahead")}</Label>
            <Input
              id="maxDaysAhead"
              name="maxDaysAhead"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.maxDaysAhead}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="acceptingBookings"
            defaultChecked={settings.acceptingBookings}
            value="on"
          />
          {t("accepting")}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="emergencyAvailable"
            defaultChecked={settings.emergencyAvailable}
            value="on"
          />
          {t("emergency")}
        </label>
        <Button type="submit" className="min-h-11 rounded-xl" disabled={pending}>
          {t("save")}
        </Button>
      </form>

      <form
        className="space-y-3 rounded-3xl border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            await blockTimeAction(fd);
            router.refresh();
            e.currentTarget.reset();
          });
        }}
      >
        <h2 className="text-lg font-bold">{t("blockTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="startsAt">{t("blockStart")}</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endsAt">{t("blockEnd")}</Label>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              required
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">{t("blockReason")}</Label>
          <Input id="reason" name="reason" className="h-11 rounded-xl" />
        </div>
        <input type="hidden" name="kind" value="vacation" />
        <Button type="submit" variant="outline" className="min-h-11 rounded-xl" disabled={pending}>
          {t("blockSubmit")}
        </Button>
      </form>
    </div>
  );
}
