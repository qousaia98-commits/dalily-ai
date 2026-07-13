import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { ProviderGalleryManager } from "@/components/business/provider-gallery-manager";
import { ProviderCreateForm } from "@/components/business/provider-create-form";

export default async function BusinessGalleryPage() {
  const t = await getTranslations("business.gallery");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("noProvider")}</p>
        </div>
        <ProviderCreateForm />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ProviderGalleryManager provider={provider} />
    </div>
  );
}
