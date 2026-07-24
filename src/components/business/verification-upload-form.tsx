"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  submitVerificationAction,
  type VerificationActionState,
} from "@/actions/verification.actions";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import type { ProviderStatus } from "@/types/database.types";
import { VerificationDocUpload } from "@/components/business/verification-doc-upload";
import {
  VerificationStatusPanel,
  type VerificationDisplayStatus,
} from "@/components/business/verification-status-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: VerificationActionState = { success: false };

type VerificationUploadFormProps = {
  providerId: string;
  providerStatus: ProviderStatus;
  verification: BusinessVerificationView;
  displayStatus: VerificationDisplayStatus;
};

export function VerificationUploadForm({
  providerId,
  providerStatus,
  verification,
  displayStatus,
}: VerificationUploadFormProps) {
  const t = useTranslations("business.verification");
  const router = useRouter();
  const [submitState, submitAction, submitPending] = useActionState(
    submitVerificationAction,
    initialState,
  );

  const isApproved = verification.status === "approved";
  const isPendingReview =
    verification.status === "pending" &&
    verification.idFrontUploaded &&
    verification.idBackUploaded &&
    verification.selfieUploaded;
  const isRejected = verification.status === "rejected";
  const canUpload = !isApproved && (!isPendingReview || isRejected);

  const allUploaded =
    verification.idFrontUploaded &&
    verification.idBackUploaded &&
    verification.selfieUploaded;

  return (
    <div className="space-y-6">
      <VerificationStatusPanel
        status={displayStatus}
        rejectionReason={verification.rejectionReason}
      />

      {canUpload ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t("documentsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("documentsHint")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <VerificationDocUpload
              label={t("documents.idFront")}
              docType="id_front"
              providerId={providerId}
              uploaded={verification.idFrontUploaded}
              disabled={!canUpload}
            />
            <VerificationDocUpload
              label={t("documents.idBack")}
              docType="id_back"
              providerId={providerId}
              uploaded={verification.idBackUploaded}
              disabled={!canUpload}
            />
            <VerificationDocUpload
              label={t("documents.selfie")}
              docType="selfie"
              providerId={providerId}
              uploaded={verification.selfieUploaded}
              disabled={!canUpload}
            />

            {allUploaded ? (
              <form
                action={submitAction}
                noValidate
                onSubmit={() => {
                  setTimeout(() => router.refresh(), 300);
                }}
              >
                <Button type="submit" className="min-h-11 w-full gap-2 rounded-2xl" disabled={submitPending}>
                  {submitPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("submitForReview")}
                </Button>
                {submitState.error ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {t(`errors.${submitState.error}`)}
                  </p>
                ) : null}
                {submitState.success ? (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                    {t("submitSuccess")}
                  </p>
                ) : null}
              </form>
            ) : null}

            {providerStatus === "draft" ? (
              <p className="text-sm text-muted-foreground">{t("draftHint")}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
