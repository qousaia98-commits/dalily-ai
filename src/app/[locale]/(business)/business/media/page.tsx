import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getProviderPlanLimits } from "@/lib/subscription/get-provider-limits";
import { MAX_GALLERY_IMAGES } from "@/lib/providers/constants";
import { BusinessMediaManager } from "@/components/business/business-media-manager";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";

export default async function BusinessMediaPage() {
  const t = await getTranslations("business.media");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("noProvider")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  const limits = await getProviderPlanLimits(provider.id);
  const maxImages = Math.min(limits.maxImages ?? MAX_GALLERY_IMAGES, MAX_GALLERY_IMAGES);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">
          {t("title")}
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </div>
      <BusinessMediaManager provider={provider} maxImages={maxImages} />
    </div>
  );
}
