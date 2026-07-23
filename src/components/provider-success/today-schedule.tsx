"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { MessageCircle, CalendarDays, Navigation } from "lucide-react";
import type { TodayAppointment } from "@/lib/provider-success/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildNavigationUrl } from "@/lib/smart-map/navigation";

export function TodaySchedule({ appointments }: { appointments: TodayAppointment[] }) {
  const t = useTranslations("business.success.schedule");
  const locale = useLocale();

  return (
    <section className="space-y-3" aria-labelledby="today-schedule-title">
      <div>
        <h2 id="today-schedule-title" className="text-lg font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {appointments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {appointments.map((a) => {
            const time = new Date(a.startsAt).toLocaleTimeString(
              locale === "ar" ? "ar" : "en",
              { hour: "2-digit", minute: "2-digit" },
            );
            const navHref =
              a.locationLat != null && a.locationLng != null
                ? buildNavigationUrl(a.locationLat, a.locationLng)
                : null;
            return (
              <li
                key={a.bookingId}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{time}</p>
                    <p className="text-sm text-muted-foreground">{a.customerLabel}</p>
                    {a.serviceName ? (
                      <p className="text-sm">{a.serviceName}</p>
                    ) : null}
                    {a.locationText ? (
                      <p className="mt-1 text-xs text-muted-foreground">{a.locationText}</p>
                    ) : null}
                  </div>
                  <Badge variant="secondary">{t(`status.${a.status}` as "status.confirmed")}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.conversationId ? (
                    <Button asChild variant="outline" size="sm" className="min-h-11 rounded-xl">
                      <Link href={`/business/messages/${a.conversationId}`}>
                        <MessageCircle className="size-4" aria-hidden />
                        {t("openChat")}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm" className="min-h-11 rounded-xl">
                    <Link href={`/business/bookings/${a.bookingId}`}>
                      <CalendarDays className="size-4" aria-hidden />
                      {t("openBooking")}
                    </Link>
                  </Button>
                  {navHref ? (
                    <Button asChild variant="outline" size="sm" className="min-h-11 rounded-xl">
                      <a href={navHref} target="_blank" rel="noopener noreferrer">
                        <Navigation className="size-4" aria-hidden />
                        {t("navigate")}
                      </a>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
