import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { listCustomerBookings } from "@/lib/booking/booking-service";
import { processCompletionPrompts } from "@/lib/booking/completion-service";
import { BookingCalendarLazy } from "@/components/booking/booking-calendar-lazy";

export default async function AccountBookingsPage() {
  const t = await getTranslations("booking");
  const authUser = await requireAuthUser();

  // Lazy promote past appointments + send prompts (idempotent)
  try {
    await processCompletionPrompts();
  } catch {
    /* soft — cron is the primary path */
  }

  const bookings = await listCustomerBookings(authUser.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("myBookingsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("myBookingsSubtitle")}</p>
      </header>
      <BookingCalendarLazy
        bookings={bookings}
        viewer="customer"
        customerId={authUser.id}
      />
    </div>
  );
}
