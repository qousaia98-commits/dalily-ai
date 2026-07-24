import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProviderForVerification } from "@/lib/providers/database";
import {
  getProviderVerificationForOwner,
  toBusinessVerificationView,
} from "@/lib/verification/queries";
import {
  buildVerificationTimeline,
  resolveVerificationFeedback,
  resolveVerificationUiStatus,
} from "@/lib/verification/status";
import { markVerificationNotificationsRead } from "@/lib/service-requests/queries";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { VerificationUploadForm } from "@/components/business/verification-upload-form";
import { VerificationTimeline } from "@/components/business/verification-timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

  // Opening the verification page clears verification notification badges.
  await markVerificationNotificationsRead(authUser.id);

  const verificationRow = await getProviderVerificationForOwner(provider.id);
  const verification = toBusinessVerificationView(verificationRow);
  const displayStatus = resolveVerificationUiStatus(provider, verification);
  const feedback = resolveVerificationFeedback(provider, verification);
  const timeline = buildVerificationTimeline({
    provider,
    verification,
    feedback,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="rounded-2xl">
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
              {t(`displayStatus.${displayStatus === "changes_requested" ? "changes_requested" : displayStatus === "expired" ? "draft" : displayStatus}`)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {t(
                `displayNotes.${
                  displayStatus === "changes_requested"
                    ? "changes_requested"
                    : displayStatus === "expired"
                      ? "draft"
                      : displayStatus
                }`,
              )}
            </p>
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
        displayStatus={displayStatus}
        feedback={feedback}
      />

      <VerificationTimeline events={timeline} />
    </div>
  );
}
