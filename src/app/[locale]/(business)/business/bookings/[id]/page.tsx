import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getBookingById } from "@/lib/booking/booking-service";
import { BookingCard } from "@/components/booking/booking-card";

type Props = { params: Promise<{ id: string }> };

export default async function BusinessBookingDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("booking");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) notFound();

  const booking = await getBookingById(id);
  if (!booking || booking.providerId !== provider.id) notFound();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("detailTitle")}</h1>
      </header>
      <BookingCard booking={booking} viewer="business" />
    </div>
  );
}
