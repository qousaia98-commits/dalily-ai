"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Loader2 } from "lucide-react";
import { submitVerificationAction } from "@/actions/verification.actions";
import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import type { CategoryGroupWithLeaves } from "@/lib/categories/types";
import type { OnboardingPhase } from "@/lib/business/onboarding";
import { cn } from "@/lib/utils";
import { WelcomeLanding } from "./welcome-landing";
import { OnboardingIdentityStep } from "./onboarding-identity-step";
import { OnboardingProfileStep } from "./onboarding-profile-step";
import { OnboardingSuccessStep } from "./onboarding-success-step";

const STEPS: OnboardingPhase[] = ["identity", "profile", "success"];

type Props = {
  provider: ManagedProvider;
  verification: BusinessVerificationView;
  categoryGroups: CategoryGroupWithLeaves[];
  categorySlug: string;
  initialPhase: OnboardingPhase;
  alreadySubmitted: boolean;
  showWelcomeFirst: boolean;
};

export function BusinessOnboardingWizard({
  provider,
  verification,
  categoryGroups,
  categorySlug,
  initialPhase,
  alreadySubmitted,
  showWelcomeFirst,
}: Props) {
  const t = useTranslations("business.onboarding");
  const te = useTranslations("business.verification");
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(showWelcomeFirst && initialPhase === "identity");
  const [phase, setPhase] = useState<OnboardingPhase>(initialPhase);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stepIndex = useMemo(() => STEPS.indexOf(phase), [phase]);

  function finishAndSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      if (
        !alreadySubmitted &&
        (provider.status === "draft" || provider.status === "changes_requested")
      ) {
        const result = await submitVerificationAction();
        if (!result.success && result.error !== "already_submitted") {
          setSubmitError(
            te(`errors.${(result.error ?? "submit_failed") as "submit_failed"}`),
          );
          return;
        }
      }
      setPhase("success");
      router.refresh();
    });
  }

  if (showIntro) {
    return <WelcomeLanding onCompleteNow={() => setShowIntro(false)} />;
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      {phase !== "success" ? (
        <nav aria-label={t("progressLabel")} className="space-y-3">
          <ol className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <li key={step} className="flex flex-1 flex-col gap-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-colors",
                      done || current ? "bg-[var(--dalily-gold)]" : "bg-border",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[0.65rem] font-semibold uppercase tracking-wide",
                      current ? "text-[var(--dalily-navy)]" : "text-muted-foreground",
                    )}
                  >
                    {t(`steps.${step}`)}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="text-center text-xs text-muted-foreground sm:text-start">
            {t("stepOf", { current: stepIndex + 1, total: STEPS.length })}
          </p>
        </nav>
      ) : null}

      <div className="rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-[0_16px_48px_-24px_rgba(11,21,38,0.28)] sm:p-8">
        {phase === "identity" ? (
          <OnboardingIdentityStep
            providerId={provider.id}
            verification={verification}
            onContinue={() => setPhase("profile")}
          />
        ) : null}

        {phase === "profile" ? (
          <OnboardingProfileStep
            provider={provider}
            categoryGroups={categoryGroups}
            categorySlug={categorySlug}
            onBack={() => setPhase("identity")}
            onFinished={finishAndSubmit}
          />
        ) : null}

        {phase === "success" ? <OnboardingSuccessStep /> : null}

        {pending && phase === "profile" ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("submitting")}
          </div>
        ) : null}

        {submitError ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
