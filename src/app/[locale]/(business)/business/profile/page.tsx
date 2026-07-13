import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { ProviderProfileEditor } from "@/components/business/provider-profile-editor";
import { ProviderCreateForm } from "@/components/business/provider-create-form";

export default async function BusinessProfilePage() {
  const t = await getTranslations("business.profile");
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
      <ProviderProfileEditor provider={provider} />
    </div>
  );
}
