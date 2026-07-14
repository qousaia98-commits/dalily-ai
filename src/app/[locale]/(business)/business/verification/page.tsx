import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProviderForVerification } from "@/lib/providers/public-queries";
import {
  getProviderVerificationForOwner,
  toBusinessVerificationView,
} from "@/lib/verification/queries";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { VerificationUploadForm } from "@/components/business/verification-upload-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ProviderVerificationStatus } from "@/lib/verification/queries";

function resolveDisplayStatus(
  providerStatus: string,
  verificationStatus: ProviderVerificationStatus | null,
  docsComplete: boolean,
): "draft" | "pending_review" | "approved" | "rejected" {
  if (verificationStatus === "approved") return "approved";
  if (verificationStatus === "rejected") return "rejected";
  if (verificationStatus === "pending" && docsComplete) return "pending_review";
  if (providerStatus === "pending_review") return "pending_review";
  return "draft";
}

export default async function BusinessVerificationPage() {
  const t = await getTranslations("business.verification");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProviderForVerification(authUser.id);

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

  const verificationRow = await getProviderVerificationForOwner(provider.id);
  const verification = toBusinessVerificationView(verificationRow);
  const docsComplete =
    verification.idFrontUploaded && verification.idBackUploaded && verification.selfieUploaded;
  const displayStatus = resolveDisplayStatus(provider.status, verification.status, docsComplete);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge
              variant={
                displayStatus === "approved"
                  ? "success"
                  : displayStatus === "rejected"
                    ? "destructive"
                    : "secondary"
              }
              className="mb-2"
            >
              {t(`displayStatus.${displayStatus}`)}
            </Badge>
            <p className="text-sm text-muted-foreground">{t(`displayNotes.${displayStatus}`)}</p>
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold">{provider.trustScore}%</p>
            <p className="text-sm text-muted-foreground">{t("trustScore")}</p>
          </div>
        </CardContent>
      </Card>

      <VerificationUploadForm
        providerId={provider.id}
        providerStatus={provider.status}
        verification={verification}
      />
    </div>
  );
}
