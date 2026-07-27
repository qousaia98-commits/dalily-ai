import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isAiBusinessAssistantEnabled } from "@/lib/config/feature-flags";
import { getProviderBusinessAssistant } from "@/lib/business-assistant/service";
import { ProviderBusinessAssistantPanel } from "@/components/business-assistant/provider-business-assistant-panel";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";

export default async function BusinessAssistantPage() {
  if (!isAiBusinessAssistantEnabled()) redirect("/business");

  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  const t = await getTranslations("businessAssistant.provider");

  if (!provider) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  const data = await getProviderBusinessAssistant({
    providerId: provider.id,
    persist: true,
  });

  if (!data) redirect("/business");

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <ProviderBusinessAssistantPanel data={data} />
    </div>
  );
}
