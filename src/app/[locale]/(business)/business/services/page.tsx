import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { ProviderServicesManager } from "@/components/business/provider-services-manager";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";

export default async function BusinessServicesPage() {
  const t = await getTranslations("business.services");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("noProvider")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ProviderServicesManager provider={provider} />
    </div>
  );
}
