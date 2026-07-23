"use client";

import dynamic from "next/dynamic";
import { useBookingRealtime } from "@/hooks/use-booking-realtime";
import type { Booking } from "@/lib/booking/types";

const BookingCalendar = dynamic(
  () =>
    import("@/components/booking/booking-calendar").then((m) => m.BookingCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        …
      </div>
    ),
  },
);

type Props = {
  bookings: Booking[];
  viewer: "customer" | "business";
  providerId?: string | null;
  customerId?: string | null;
};

export function BookingCalendarLazy({
  bookings,
  viewer,
  providerId,
  customerId,
}: Props) {
  useBookingRealtime({
    providerId: viewer === "business" ? providerId : null,
    customerId: viewer === "customer" ? customerId : null,
  });

  return <BookingCalendar bookings={bookings} viewer={viewer} />;
}
