import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getAvailabilitySettings } from "@/lib/booking/availability-service";
import { AvailabilityManager } from "@/components/booking/availability-manager";

export default async function BusinessAvailabilityPage() {
  const t = await getTranslations("booking.availability");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <p className="text-sm text-muted-foreground">{t("noProvider")}</p>
      </div>
    );
  }

  const settings = await getAvailabilitySettings(provider.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 overflow-x-hidden animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </header>
      <AvailabilityManager settings={settings} />
    </div>
  );
}
