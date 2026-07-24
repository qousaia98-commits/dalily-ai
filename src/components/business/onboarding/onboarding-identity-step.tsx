"use client";

import { useTranslations } from "next-intl";
import { IdCard, ShieldCheck } from "lucide-react";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import { VerificationDocUpload } from "@/components/business/verification-doc-upload";
import { Button } from "@/components/ui/button";

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
        <VerificationDocUpload
          label={t("idFront")}
          docType="id_front"
          providerId={providerId}
          uploaded={verification.idFrontUploaded}
          disabled={uploadLocked}
          variant="onboarding"
        />
        <VerificationDocUpload
          label={t("idBack")}
          docType="id_back"
          providerId={providerId}
          uploaded={verification.idBackUploaded}
          disabled={uploadLocked}
          variant="onboarding"
        />
        <VerificationDocUpload
          label={t("selfie")}
          docType="selfie"
          providerId={providerId}
          uploaded={verification.selfieUploaded}
          disabled={uploadLocked}
          variant="onboarding"
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">{t("autosaveHint")}</p>
      <p className="text-center text-xs text-muted-foreground">{t("photoHint")}</p>

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
