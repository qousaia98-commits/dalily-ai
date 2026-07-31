"use client";

import { ShieldCheck } from "lucide-react";
import { useIntentFlow } from "./hooks/useIntentFlow";
import type { IntentIntakeFlowProps } from "./types";
import { IntentStep } from "./steps/IntentStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { CategoryStep } from "./steps/CategoryStep";
import { DescriptionStep } from "./steps/DescriptionStep";
import { MediaStep } from "./steps/MediaStep";
import { LocationStep } from "./steps/LocationStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { ReviewStep } from "./steps/ReviewStep";

export function IntentIntakeFlow({
  initialIntent = "",
  cities,
  loginHref,
  isAuthenticated,
  visionEnabled = false,
  voiceEnabled = false,
  targetProvider = null,
}: IntentIntakeFlowProps) {
  const flow = useIntentFlow({
    initialIntent,
    cities,
    loginHref,
    isAuthenticated,
    visionEnabled,
    voiceEnabled,
    targetProvider,
  });

  const t = flow.t as (key: string, values?: Record<string, string | number>) => string;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 animate-fade-in">
      <div className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
        <p>{flow.t("trust.privacy")}</p>
      </div>

      {flow.targetProvider ? (
        <div className="rounded-2xl border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,transparent)] px-3.5 py-3 text-sm">
          <p className="font-medium text-foreground">
            {flow.t("targeted.banner", { name: flow.targetProvider.name })}
          </p>
          <p className="mt-1 text-muted-foreground">{flow.t("targeted.bannerHint")}</p>
        </div>
      ) : null}

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.max(1, flow.stepIndex + 1)}
        aria-valuemin={1}
        aria-valuemax={6}
      >
        <div
          className="h-full rounded-full bg-[var(--dalily-gold)] transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, ((flow.stepIndex + 1) / 7) * 100)}%` }}
        />
      </div>

      {flow.step === "intent" && (
        <IntentStep
          t={t}
          pending={flow.pending}
          intentText={flow.intentText}
          onIntentTextChange={flow.setIntentText}
          suggestions={flow.suggestions}
          voiceEnabled={flow.voiceEnabled}
          categorySlug={
            flow.categories.find((c) => c.id === flow.categoryId)?.slug ||
            flow.suggestedCategorySlug ||
            undefined
          }
          onInsight={flow.setVoiceInsight}
          onContinue={flow.goSuggest}
        />
      )}

      {flow.step === "confirm" && flow.suggestion && !flow.targeted && (
        <ConfirmationStep
          t={t}
          pending={flow.pending}
          locale={flow.locale}
          suggestion={flow.suggestion}
          onAccept={flow.acceptSuggestion}
          onReject={flow.rejectSuggestion}
          onBack={() => flow.setStep("intent")}
        />
      )}

      {flow.step === "category" && !flow.targeted && (
        <CategoryStep
          t={t}
          locale={flow.locale}
          suggestion={flow.suggestion}
          categories={flow.categories}
          categoryId={flow.categoryId}
          onCategoryChange={flow.onCategoryChange}
          onBack={() => flow.setStep("intent")}
          onContinue={flow.afterCategory}
        />
      )}

      {flow.step === "clarify" && (
        <DescriptionStep
          t={t}
          completenessScore={flow.completenessScore}
          clarifyNotes={flow.clarifyNotes}
          aiQuestions={flow.aiQuestions}
          clarifyAnswers={flow.clarifyAnswers}
          onClarifyAnswerChange={(index, value) =>
            flow.setClarifyAnswers((prev) => ({ ...prev, [index]: value }))
          }
          onBack={() => flow.setStep(flow.clarifyBackStep)}
          onSkip={flow.afterClarify}
          onContinue={flow.afterClarify}
        />
      )}

      {flow.step === "photos" && (
        <MediaStep
          t={t}
          locale={flow.locale}
          photos={flow.photos}
          visionPending={flow.visionPending}
          visionError={flow.visionError}
          visionInsight={flow.visionInsight}
          showVisionCorrection={flow.showVisionCorrection}
          visionCorrection={flow.visionCorrection}
          onPhotosChange={flow.onPhotosChange}
          onConfirmVision={flow.confirmVision}
          onShowCorrection={() => flow.setShowVisionCorrection(true)}
          onVisionCorrectionChange={flow.setVisionCorrection}
          onSaveCorrection={flow.saveVisionCorrection}
          onCancelCorrection={() => flow.setShowVisionCorrection(false)}
          onBack={() => flow.setStep(flow.photosBackStep)}
          onSkip={flow.afterPhotos}
          onContinue={flow.afterPhotos}
        />
      )}

      {flow.step === "location" && (
        <LocationStep
          t={t}
          cities={flow.cities}
          cityId={flow.cityId}
          locationText={flow.locationText}
          onCityChange={flow.setCityId}
          onLocationTextChange={flow.setLocationText}
          onBack={() => flow.setStep("photos")}
          onContinue={flow.afterLocation}
        />
      )}

      {flow.step === "urgency" && (
        <ScheduleStep
          t={t}
          urgency={flow.urgency}
          onUrgencyChange={flow.setUrgency}
          onBack={() => flow.setStep("location")}
          onContinue={() => flow.setStep("publish")}
        />
      )}

      {flow.step === "publish" && (
        <ReviewStep
          t={t}
          pending={flow.pending}
          isAuthenticated={flow.isAuthenticated}
          categoryLabel={flow.categoryLabel}
          intentText={flow.intentText}
          cityLabel={flow.cityLabel}
          locationText={flow.locationText}
          urgency={flow.urgency}
          photosCount={flow.photos.length}
          onEdit={() => flow.setStep("intent")}
          onPublish={flow.publish}
        />
      )}

      {flow.error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {flow.error}
        </p>
      )}
    </div>
  );
}
