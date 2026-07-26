import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { listProviderBookings } from "@/lib/booking/booking-service";
import { BookingCalendarLazy } from "@/components/booking/booking-calendar-lazy";
import { DayOptimizePanel } from "@/components/booking/day-optimize-panel";
import { isSmartBookingEnabled } from "@/lib/config/feature-flags";

export default async function BusinessCalendarPage() {
  const t = await getTranslations("booking.calendar");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  const bookings = provider ? await listProviderBookings(provider.id) : [];
  const smart = isSmartBookingEnabled();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {provider && smart ? <DayOptimizePanel providerId={provider.id} /> : null}

      {provider ? (
        <BookingCalendarLazy
          bookings={bookings}
          viewer="business"
          providerId={provider.id}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
