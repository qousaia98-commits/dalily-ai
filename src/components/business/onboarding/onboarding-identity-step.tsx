"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { CheckCircle2, IdCard, Loader2, ShieldCheck } from "lucide-react";
import {
  uploadVerificationDocumentAction,
  type VerificationActionState,
} from "@/actions/verification.actions";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: VerificationActionState = { success: false };

function DocUpload({
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
  const t = useTranslations("business.onboarding.identity");
  const te = useTranslations("business.verification");
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadVerificationDocumentAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-4">
      <input type="hidden" name="docType" value={docType} />
      <input type="hidden" name="providerId" value={providerId} />
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`onboard-${docType}`} className="text-sm font-semibold">
          {label}
        </Label>
        {uploaded ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {t("uploaded")}
          </span>
        ) : null}
      </div>
      <Input
        id={`onboard-${docType}`}
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required={!uploaded}
        disabled={disabled || pending}
        className="rounded-xl"
      />
      <Button
        type="submit"
        variant="outline"
        className="min-h-11 w-full rounded-xl"
        disabled={disabled || pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("upload")}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {te(`errors.${state.error as "upload_failed"}`)}
        </p>
      ) : null}
    </form>
  );
}

type Props = {
  providerId: string;
  verification: BusinessVerificationView;
  onContinue: () => void;
};

export function OnboardingIdentityStep({ providerId, verification, onContinue }: Props) {
  const t = useTranslations("business.onboarding.identity");

  const allUploaded =
    verification.idFrontUploaded &&
    verification.idBackUploaded &&
    verification.selfieUploaded;

  const uploadLocked = verification.status === "approved";

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center sm:text-start">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)] sm:mx-0">
          <IdCard className="size-7" aria-hidden />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-[var(--dalily-gold)]/25 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,white)] p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
        <p className="text-sm leading-relaxed text-[var(--dalily-navy)]">{t("why")}</p>
      </div>

      <div className="space-y-3">
        <DocUpload
          label={t("idFront")}
          docType="id_front"
          providerId={providerId}
          uploaded={verification.idFrontUploaded}
          disabled={uploadLocked}
        />
        <DocUpload
          label={t("idBack")}
          docType="id_back"
          providerId={providerId}
          uploaded={verification.idBackUploaded}
          disabled={uploadLocked}
        />
        <DocUpload
          label={t("selfie")}
          docType="selfie"
          providerId={providerId}
          uploaded={verification.selfieUploaded}
          disabled={uploadLocked}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">{t("autosaveHint")}</p>

      <Button
        type="button"
        className="h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
        disabled={!allUploaded}
        onClick={onContinue}
      >
        {t("continue")}
      </Button>
    </div>
  );
}
