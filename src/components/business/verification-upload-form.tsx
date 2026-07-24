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
import type { VerificationAdminFeedback } from "@/lib/verification/feedback";
import type { VerificationUiStatus } from "@/lib/verification/feedback";
import { VerificationDocUpload } from "@/components/business/verification-doc-upload";
import { VerificationStatusCard } from "@/components/business/verification-status-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: VerificationActionState = { success: false };

type VerificationUploadFormProps = {
  providerId: string;
  providerStatus: ProviderStatus;
  verification: BusinessVerificationView;
  displayStatus: VerificationUiStatus;
  feedback?: VerificationAdminFeedback | null;
};

export function VerificationUploadForm({
  providerId,
  providerStatus,
  verification,
  displayStatus,
  feedback = null,
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
  const canUpload =
    !isApproved &&
    (!isPendingReview || isRejected || providerStatus === "changes_requested");

  const allUploaded =
    verification.idFrontUploaded &&
    verification.idBackUploaded &&
    verification.selfieUploaded;

  const showResubmitHint = isRejected || providerStatus === "changes_requested";

  return (
    <div className="space-y-6">
      <VerificationStatusCard
        status={displayStatus === "expired" ? "draft" : displayStatus}
        feedback={feedback}
        showAction={false}
      />

      {showResubmitHint ? (
        <p className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t("resubmitHint")}
        </p>
      ) : null}

      {canUpload ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>
              {showResubmitHint ? t("resubmitTitle") : t("documentsTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {showResubmitHint ? t("resubmitSubtitle") : t("documentsHint")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <VerificationDocUpload
              label={t("documents.idFront")}
              docType="id_front"
              providerId={providerId}
              uploaded={verification.idFrontUploaded}
              disabled={!canUpload}
              allowReplace={showResubmitHint}
            />
            <VerificationDocUpload
              label={t("documents.idBack")}
              docType="id_back"
              providerId={providerId}
              uploaded={verification.idBackUploaded}
              disabled={!canUpload}
              allowReplace={showResubmitHint}
            />
            <VerificationDocUpload
              label={t("documents.selfie")}
              docType="selfie"
              providerId={providerId}
              uploaded={verification.selfieUploaded}
              disabled={!canUpload}
              allowReplace={showResubmitHint}
            />

            {allUploaded ? (
              <form
                action={submitAction}
                noValidate
                onSubmit={() => {
                  setTimeout(() => router.refresh(), 300);
                }}
              >
                <Button
                  type="submit"
                  className="min-h-11 w-full gap-2 rounded-2xl"
                  disabled={submitPending}
                >
                  {submitPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {showResubmitHint ? t("submitAgain") : t("submitForReview")}
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

            {providerStatus === "draft" && !showResubmitHint ? (
              <p className="text-sm text-muted-foreground">{t("draftHint")}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
