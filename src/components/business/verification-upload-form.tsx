"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { Link } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, LayoutDashboard } from "lucide-react";
import {
  submitVerificationAction,
  type VerificationActionState,
} from "@/actions/verification.actions";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import type { ProviderStatus, VerificationStatus } from "@/types/database.types";
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
  providerVerificationStatus: VerificationStatus;
  verification: BusinessVerificationView;
  displayStatus: VerificationUiStatus;
  feedback?: VerificationAdminFeedback | null;
};

export function VerificationUploadForm({
  providerId,
  providerStatus,
  providerVerificationStatus,
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
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (submitState.success) {
      setShowSuccess(true);
      router.refresh();
    }
  }, [submitState.success, router]);

  const isApproved = verification.status === "approved";
  const allUploaded =
    verification.idFrontUploaded &&
    verification.idBackUploaded &&
    verification.selfieUploaded;

  // Still replacing docs after reject / changes — do not lock the form yet.
  const isResubmitting =
    providerVerificationStatus === "rejected" ||
    providerStatus === "changes_requested" ||
    verification.status === "rejected";

  const lockedForAdminReview =
    verification.status === "pending" &&
    allUploaded &&
    !isResubmitting &&
    (providerStatus === "pending_review" || providerVerificationStatus === "pending");

  const canUpload = !isApproved && !lockedForAdminReview && !showSuccess;
  const showResubmitHint = isResubmitting && !showSuccess;

  // After successful submit — local success + pending card (no full onboarding restart).
  if (showSuccess || (displayStatus === "pending_review" && submitState.success)) {
    return (
      <div className="space-y-6">
        <VerificationStatusCard status="pending_review" showAction={false} />

        <div className="rounded-3xl border border-sky-500/30 bg-sky-500/10 p-6 text-center sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-sky-500/20 text-sky-700">
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {t("resubmitSuccess.title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("resubmitSuccess.body")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("resubmitSuccess.next")}
          </p>
          <Button
            asChild
            className="mt-6 h-12 min-h-11 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:w-auto sm:min-w-52"
          >
            <Link href="/business" className="gap-2">
              <LayoutDashboard className="size-4" aria-hidden />
              {t("resubmitSuccess.dashboard")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <VerificationStatusCard
        status={
          lockedForAdminReview
            ? "pending_review"
            : displayStatus === "expired"
              ? "draft"
              : displayStatus
        }
        feedback={isResubmitting ? feedback : null}
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
              <form action={submitAction} noValidate>
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
