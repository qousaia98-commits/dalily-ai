"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  acceptBookingAction,
  cancelBookingAction,
  completeBookingAction,
  declineBookingAction,
} from "@/actions/booking.actions";
import type { Booking } from "@/lib/booking/types";
import { OpenRouteButton } from "@/components/providers/open-route-button";
import { CompletionConfirmationPanel } from "@/components/booking/completion-confirmation-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  booking: Booking;
  viewer: "customer" | "business";
};

export function BookingCard({ booking, viewer }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const when = new Date(booking.startsAt).toLocaleString(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  };

  return (
    <article className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-foreground">{when}</p>
          <p className="text-sm text-muted-foreground">
            {t("minutes", { count: booking.durationMinutes })}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            booking.status === "confirmed" && "bg-emerald-500/15 text-emerald-700",
            booking.status === "pending" && "bg-amber-500/15 text-amber-800",
            booking.status === "awaiting_customer_confirmation" &&
              "bg-sky-500/15 text-sky-800",
            booking.status === "issue_reported" && "bg-amber-500/15 text-amber-900",
            booking.status === "cancelled" && "bg-destructive/10 text-destructive",
            booking.status === "completed" && "bg-emerald-500/15 text-emerald-800",
          )}
        >
          {t(`status.${booking.status}`)}
        </Badge>
      </div>

      {booking.locationText ? (
        <p className="text-sm text-muted-foreground">{booking.locationText}</p>
      ) : null}

      {booking.locationLat != null && booking.locationLng != null ? (
        <OpenRouteButton lat={booking.locationLat} lng={booking.locationLng} />
      ) : null}

      {booking.customerNotes ? (
        <p className="rounded-2xl bg-muted/40 px-3 py-2 text-sm">{booking.customerNotes}</p>
      ) : null}

      {viewer === "customer" ? <CompletionConfirmationPanel booking={booking} /> : null}

      <div className="flex flex-wrap gap-2">
        {viewer === "business" &&
        (booking.status === "pending" || booking.status === "rescheduled") ? (
          <>
            <Button
              className="min-h-11 rounded-xl"
              disabled={pending}
              onClick={() => run(() => acceptBookingAction(booking.id))}
            >
              {t("actions.accept")}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              disabled={pending}
              onClick={() => run(() => declineBookingAction(booking.id))}
            >
              {t("actions.decline")}
            </Button>
          </>
        ) : null}
        {viewer === "business" &&
        (booking.status === "confirmed" || booking.status === "issue_reported") ? (
          <Button
            className="min-h-11 rounded-xl"
            disabled={pending}
            onClick={() => run(() => completeBookingAction(booking.id))}
          >
            {t("actions.requestConfirmation")}
          </Button>
        ) : null}
        {["pending", "confirmed", "awaiting_customer_confirmation", "issue_reported"].includes(
          booking.status,
        ) ? (
          <Button
            variant="ghost"
            className="min-h-11 rounded-xl text-destructive"
            disabled={pending}
            onClick={() => run(() => cancelBookingAction(booking.id))}
          >
            {t("actions.cancel")}
          </Button>
        ) : null}
        {viewer === "customer" &&
        booking.status === "completed" &&
        booking.serviceRequestId ? (
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <a href={`/${locale}/account/requests/${booking.serviceRequestId}`}>
              {t("actions.leaveReview")}
            </a>
          </Button>
        ) : null}
        {viewer === "customer" &&
        booking.status === "issue_reported" &&
        booking.conversationId ? (
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <a href={`/${locale}/messages/${booking.conversationId}`}>
              {t("actions.openChat")}
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
