"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import {
  submitVerificationAction,
  uploadVerificationDocumentAction,
  type VerificationActionState,
} from "@/actions/verification.actions";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import type { ProviderStatus } from "@/types/database.types";
import { FieldError } from "@/components/forms/field-error";
import { useClientFormValidation } from "@/hooks/use-client-form-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: VerificationActionState = { success: false };

type VerificationUploadFormProps = {
  providerId: string;
  providerStatus: ProviderStatus;
  verification: BusinessVerificationView;
};

function UploadField({
  label,
  docType,
  providerId,
  uploaded,
  disabled,
}: {
  label: string;
  docType: "id_front" | "id_back" | "selfie";
  providerId: string;
  uploaded: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("business.verification");
  const [state, action, pending] = useActionState(uploadVerificationDocumentAction, initialState);
  const formId = `verify-${docType}`;
  const { fieldErrors, guardSubmit, getFieldA11y, requiredAttr, clearFieldError } =
    useClientFormValidation({ formId });

  return (
    <form
      action={action}
      className="space-y-2 rounded-lg border p-4"
      noValidate
      onSubmit={guardSubmit}
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${docType}-file`}>{label}</Label>
        {uploaded ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t("uploaded")}
          </span>
        ) : null}
      </div>
      <input type="hidden" name="docType" value={docType} />
      <Input
        id={`${docType}-file`}
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || pending}
        {...(!uploaded ? requiredAttr : {})}
        {...getFieldA11y("file")}
        onChange={() => clearFieldError("file")}
      />
      <FieldError name="file" formId={formId} message={fieldErrors.file} />
      <Button type="submit" variant="outline" className="gap-2" disabled={disabled || pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {t("upload")}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${state.error as "upload_failed"}`)}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("uploadSuccess")}</p>
      ) : null}
      <input type="hidden" name="providerId" value={providerId} />
    </form>
  );
}

export function VerificationUploadForm({
  providerId,
  providerStatus,
  verification,
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
      {isApproved ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {t("approvedBanner")}
        </div>
      ) : null}

      {isRejected && verification.rejectionReason ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">{t("rejectionTitle")}</p>
          <p className="mt-1">{verification.rejectionReason}</p>
        </div>
      ) : null}

      {isPendingReview && !isRejected ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t("pendingBanner")}
        </div>
      ) : null}

      {canUpload ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("documentsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadField
              label={t("documents.idFront")}
              docType="id_front"
              providerId={providerId}
              uploaded={verification.idFrontUploaded}
              disabled={!canUpload}
            />
            <UploadField
              label={t("documents.idBack")}
              docType="id_back"
              providerId={providerId}
              uploaded={verification.idBackUploaded}
              disabled={!canUpload}
            />
            <UploadField
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
                <Button type="submit" className="w-full gap-2" disabled={submitPending}>
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
