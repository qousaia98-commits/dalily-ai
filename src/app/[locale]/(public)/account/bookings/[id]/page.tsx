import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getBookingById } from "@/lib/booking/booking-service";
import { BookingCard } from "@/components/booking/booking-card";
import { OpenRouteButton } from "@/components/providers/open-route-button";

type Props = { params: Promise<{ id: string }> };

export default async function AccountBookingDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("booking");
  const authUser = await requireAuthUser();
  const booking = await getBookingById(id);

  if (!booking || booking.customerId !== authUser.id) notFound();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("detailTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("confirmHint")}</p>
      </header>

      <BookingCard booking={booking} viewer="customer" />

      {booking.locationLat != null && booking.locationLng != null ? (
        <section className="space-y-2 rounded-3xl border border-border bg-card p-4">
          <h2 className="font-semibold">{t("navigateTitle")}</h2>
          {booking.locationText ? (
            <p className="text-sm text-muted-foreground">{booking.locationText}</p>
          ) : null}
          <OpenRouteButton lat={booking.locationLat} lng={booking.locationLng} />
        </section>
      ) : booking.locationText ? (
        <p className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm">
          {booking.locationText}
        </p>
      ) : null}
    </div>
  );
}
