"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/lib/booking/types";
import { BookingCard } from "@/components/booking/booking-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type View = "day" | "week" | "month" | "agenda";

type Props = {
  bookings: Booking[];
  viewer: "customer" | "business";
};

export function BookingCalendar({ bookings, viewer }: Props) {
  const t = useTranslations("booking.calendar");
  const locale = useLocale();
  const [view, setView] = useState<View>("agenda");
  const [anchor, setAnchor] = useState(() => new Date());

  const filtered = useMemo(() => {
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);

    if (view === "day") end.setDate(start.getDate() + 1);
    else if (view === "week") end.setDate(start.getDate() + 7);
    else if (view === "month") end.setMonth(start.getMonth() + 1);
    else return bookings;

    return bookings.filter((b) => {
      const s = new Date(b.startsAt);
      return s >= start && s < end;
    });
  }, [bookings, anchor, view]);

  const pending = bookings.filter((b) => b.status === "pending");
  const today = bookings.filter((b) => {
    const d = new Date(b.startsAt);
    const n = new Date();
    return d.toDateString() === n.toDateString() && ["pending", "confirmed"].includes(b.status);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["day", "week", "month", "agenda"] as View[]).map((v) => (
          <Button
            key={v}
            type="button"
            variant={view === v ? "default" : "outline"}
            className="min-h-11 rounded-xl"
            onClick={() => setView(v)}
          >
            {t(`views.${v}`)}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {anchor.toLocaleDateString(locale === "ar" ? "ar" : "en", {
            month: "long",
            year: "numeric",
            day: view === "day" ? "numeric" : undefined,
          })}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => {
              const d = new Date(anchor);
              if (view === "month") d.setMonth(d.getMonth() - 1);
              else d.setDate(d.getDate() - (view === "week" ? 7 : 1));
              setAnchor(d);
            }}
          >
            {t("prev")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => setAnchor(new Date())}
          >
            {t("today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => {
              const d = new Date(anchor);
              if (view === "month") d.setMonth(d.getMonth() + 1);
              else d.setDate(d.getDate() + (view === "week" ? 7 : 1));
              setAnchor(d);
            }}
          >
            {t("next")}
          </Button>
        </div>
      </div>

      {viewer === "business" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t("todayTitle")}</p>
            <p className="text-2xl font-bold">{today.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t("pendingTitle")}</p>
            <p className="text-2xl font-bold">{pending.length}</p>
          </div>
        </div>
      ) : null}

      <ul className={cn("space-y-3")}>
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        ) : (
          filtered.map((b) => (
            <li key={b.id}>
              <BookingCard booking={b} viewer={viewer} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
