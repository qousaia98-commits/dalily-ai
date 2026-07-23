import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getProviderRequestSettings } from "@/lib/service-requests/queries";
import { RequestSettingsForm } from "@/components/business/request-settings-form";

export default async function BusinessSettingsPage() {
  const t = await getTranslations("business.requestSettings");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="mx-auto max-w-lg py-10 text-sm text-muted-foreground">
        {t("noProvider")}
      </div>
    );
  }

  const settings = await getProviderRequestSettings(provider.id);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <RequestSettingsForm settings={settings} />
    </div>
  );
}
