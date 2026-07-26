"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  fetchAvailableSlotsAction,
  rescheduleBookingAction,
} from "@/actions/booking.actions";
import type { Booking, TimeSlot } from "@/lib/booking/types";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/format/datetime";

export function RescheduleBookingPanel({ booking }: { booking: Booking }) {
  const t = useTranslations("booking.reschedule");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selected, setSelected] = useState<TimeSlot | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoad(async () => {
      const fromDate = new Date().toISOString().slice(0, 10);
      const result = await fetchAvailableSlotsAction({
        providerId: booking.providerId,
        fromDate,
        durationMinutes: booking.durationMinutes,
        days: 14,
      });
      if (result.success) setSlots(result.slots.slice(0, 24));
    });
  }, [open, booking.providerId, booking.durationMinutes]);

  if (!["pending", "confirmed", "rescheduled"].includes(booking.status)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 rounded-xl"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t("close") : t("open")}
      </Button>

      {open ? (
        <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {slots.map((slot) => {
                const label = `${formatDate(slot.startsAt, locale === "ar" ? "ar" : "en", {
                  month: "short",
                  day: "numeric",
                })} ${formatTime(slot.startsAt, locale === "ar" ? "ar" : "en", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`;
                const active = selected?.startsAt === slot.startsAt;
                return (
                  <Button
                    key={slot.startsAt}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="rounded-lg"
                    onClick={() => setSelected(slot)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          )}
          <Button
            className="min-h-11 w-full rounded-xl"
            disabled={pending || !selected}
            onClick={() => {
              if (!selected) return;
              const fd = new FormData();
              fd.set("bookingId", booking.id);
              fd.set("startsAt", selected.startsAt);
              fd.set("endsAt", selected.endsAt);
              fd.set("durationMinutes", String(booking.durationMinutes));
              startTransition(async () => {
                await rescheduleBookingAction(fd);
                setOpen(false);
                router.refresh();
              });
            }}
          >
            {t("confirm")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
