"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  publishIntentRequestAction,
  suggestIntentCategoryAction,
} from "@/actions/intent-request.actions";
import {
  analyzeIntentVisionAction,
  confirmIntentVisionAction,
} from "@/actions/intent-vision.actions";
import { prepareVisionImage } from "@/domains/vision/client";
import type { IntentVoiceInsight } from "@/components/customer/intent-voice-capture";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import { getContextualSuggestionKeys } from "@/lib/intent/contextual-suggestions";
import { CLARIFY_BY_SLUG, HIGH_CONFIDENCE } from "../constants";
import { useIntentValidation } from "./useIntentValidation";
import type {
  CategoryOption,
  DecisionQuestions,
  IntentIntakeFlowProps,
  Step,
  VisionInsightState,
} from "../types";

export function useIntentFlow({
  initialIntent = "",
  cities,
  loginHref,
  isAuthenticated,
  visionEnabled = false,
  voiceEnabled = false,
}: IntentIntakeFlowProps) {
  const t = useTranslations("intentFlow");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { resolveError, isIntentTooShort, isCityRequired } = useIntentValidation(
    t as (key: string, values?: Record<string, string | number>) => string,
  );

  const [step, setStep] = useState<Step>("intent");
  const [intentText, setIntentText] = useState(initialIntent);
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  /** First AI suggestion for this intent (feedback loop — not overwritten on manual change). */
  const [suggestedCategoryId, setSuggestedCategoryId] = useState("");
  const [suggestedCategorySlug, setSuggestedCategorySlug] = useState("");
  const [suggestedConfidence, setSuggestedConfidence] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [visionInsight, setVisionInsight] = useState<VisionInsightState | null>(null);
  const [visionPending, setVisionPending] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [showVisionCorrection, setShowVisionCorrection] = useState(false);
  const [visionCorrection, setVisionCorrection] = useState("");
  const [voiceInsight, setVoiceInsight] = useState<IntentVoiceInsight | null>(null);
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [locationText, setLocationText] = useState("");
  const [urgency, setUrgency] = useState<IntentUrgency>("normal");
  const [needsUrgencyConfirm, setNeedsUrgencyConfirm] = useState(false);
  const [clarifyNotes, setClarifyNotes] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});
  const [aiQuestions, setAiQuestions] = useState<
    Array<{ id: string; promptKey: string }>
  >([]);
  const [suggestedUrgency, setSuggestedUrgency] = useState<string>("");
  const [suggestedWorkflow, setSuggestedWorkflow] = useState<string>("");
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Live category from existing suggestIntentCategoryAction (debounced). */
  const [liveCategorySlug, setLiveCategorySlug] = useState<string | null>(null);

  const resolvedCategorySlug =
    liveCategorySlug ??
    suggestion?.categorySlug ??
    categories.find((c) => c.id === categoryId)?.slug ??
    null;

  const suggestions = useMemo(() => {
    const keys = getContextualSuggestionKeys(resolvedCategorySlug);
    return keys.map((key) => t(key as "suggestions.contextual.general.g1"));
  }, [resolvedCategorySlug, t]);

  useEffect(() => {
    const text = intentText.trim();
    if (text.length < 8) {
      setLiveCategorySlug(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await suggestIntentCategoryAction(text);
        if (cancelled) return;
        setLiveCategorySlug(result.suggestion?.categorySlug ?? null);
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [intentText]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryLabel =
    selectedCategory?.label ||
    (suggestion
      ? locale === "ar"
        ? suggestion.labelAr
        : suggestion.labelEn
      : "");

  const cityLabel = cities.find((c) => c.id === cityId)?.label ?? "";

  function loadClarifyForCategory(slug: string | undefined) {
    const keys = (slug && CLARIFY_BY_SLUG[slug]) || [];
    setClarifyNotes(keys.slice(0, 2));
    setClarifyAnswers({});
  }

  function applyDecisionQuestions(
    decision: DecisionQuestions,
    fallbackSlug?: string,
  ) {
    if (decision?.questions && decision.questions.length > 0) {
      setAiQuestions(
        decision.questions.map((q) => ({ id: q.id, promptKey: q.promptKey })),
      );
      setClarifyNotes(decision.questions.map((q) => q.promptKey));
      setClarifyAnswers({});
    } else {
      setAiQuestions([]);
      loadClarifyForCategory(fallbackSlug);
    }
    setSuggestedUrgency(decision?.urgency ?? "");
    setSuggestedWorkflow(decision?.workflow?.strategy ?? "");
    setCompletenessScore(decision?.completeness?.score ?? null);
    if (decision?.marketplaceUrgency === "emergency") {
      setNeedsUrgencyConfirm(true);
      setUrgency("emergency");
    }
  }

  function goSuggest() {
    setError(null);
    const text = intentText.trim();
    if (isIntentTooShort(text)) {
      setError(resolveError("intent_too_short"));
      return;
    }
    startTransition(async () => {
      const result = await suggestIntentCategoryAction(text);
      if (!result.success) {
        setError(resolveError(result.error));
        return;
      }
      setSuggestion(result.suggestion ?? null);
      const opts =
        result.categories?.map((c) => ({
          id: c.id,
          slug: c.slug,
          label: locale === "ar" ? c.labelAr : c.labelEn,
        })) ?? [];
      setCategories(opts);
      if (result.suggestion) {
        setCategoryId(result.suggestion.categoryId);
        setSuggestedCategoryId(result.suggestion.categoryId);
        setSuggestedCategorySlug(result.suggestion.categorySlug);
        setSuggestedConfidence(result.suggestion.confidence);
        setLiveCategorySlug(result.suggestion.categorySlug);
        const hyp = result.suggestion.hypothesizedUrgency;
        setNeedsUrgencyConfirm(hyp === "emergency");
        setUrgency(hyp === "emergency" ? "emergency" : "normal");
        applyDecisionQuestions(
          result.decision ?? null,
          result.suggestion.categorySlug,
        );
        if (result.suggestion.confidence >= HIGH_CONFIDENCE) {
          setStep("confirm");
        } else {
          setStep("category");
        }
      } else if (opts[0]) {
        setCategoryId(opts[0].id);
        setSuggestedCategoryId("");
        setSuggestedCategorySlug("");
        setSuggestedConfidence(null);
        setNeedsUrgencyConfirm(false);
        setUrgency("normal");
        applyDecisionQuestions(null, opts[0].slug);
        setStep("category");
      } else {
        setStep("category");
      }
    });
  }

  function acceptSuggestion() {
    if (clarifyNotes.length > 0) {
      setStep("clarify");
      return;
    }
    setStep("photos");
  }

  function rejectSuggestion() {
    setStep("category");
  }

  function afterCategory() {
    const slug = categories.find((c) => c.id === categoryId)?.slug;
    loadClarifyForCategory(slug);
    if (slug && CLARIFY_BY_SLUG[slug]?.length) {
      setStep("clarify");
      return;
    }
    setStep("photos");
  }

  function afterClarify() {
    setStep("photos");
  }

  function afterPhotos() {
    setStep("location");
  }

  async function runVisionOnPhotos(files: File[]) {
    if (!visionEnabled || files.length === 0) {
      setVisionInsight(null);
      setVisionError(null);
      return;
    }
    setVisionPending(true);
    setVisionError(null);
    setShowVisionCorrection(false);
    setVisionCorrection("");
    try {
      const prepared = await prepareVisionImage(files[0]!);
      if (!prepared.success) {
        setVisionError(t("steps.photos.failed"));
        setVisionInsight(null);
        return;
      }
      const fd = new FormData();
      fd.set("image", prepared.image.file);
      fd.set("intentText", composedIntent());
      const slug =
        categories.find((c) => c.id === categoryId)?.slug ||
        suggestedCategorySlug ||
        "";
      if (slug) fd.set("categorySlug", slug);

      const result = await analyzeIntentVisionAction(fd);
      if (!result.success) {
        if (result.error !== "feature_disabled") {
          setVisionError(t("steps.photos.failed"));
        }
        setVisionInsight(null);
        return;
      }
      setVisionInsight({
        analysisId: result.analysisId,
        summaryEn: result.summaryEn,
        summaryAr: result.summaryAr,
        contradiction: result.contradiction,
        confirmed: null,
      });
    } catch {
      setVisionError(t("steps.photos.failed"));
      setVisionInsight(null);
    } finally {
      setVisionPending(false);
    }
  }

  function afterLocation() {
    if (isCityRequired(cityId)) {
      setError(resolveError("location_required"));
      return;
    }
    if (needsUrgencyConfirm) {
      setStep("urgency");
      return;
    }
    setStep("publish");
  }

  function composedIntent(): string {
    const base = intentText.trim();
    const extras = Object.values(clarifyAnswers)
      .map((v) => v.trim())
      .filter(Boolean);
    if (extras.length === 0) return base;
    return `${base}\n\n${extras.join(" · ")}`;
  }

  function publish() {
    setError(null);
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("intentText", composedIntent());
      fd.set("categoryId", categoryId);
      fd.set("cityId", cityId);
      fd.set("urgency", urgency);
      if (suggestedCategoryId) fd.set("suggestedCategoryId", suggestedCategoryId);
      if (suggestedCategorySlug) fd.set("suggestedCategorySlug", suggestedCategorySlug);
      if (suggestedConfidence != null) {
        fd.set("suggestedConfidence", String(suggestedConfidence));
      }
      if (suggestedUrgency) fd.set("suggestedUrgency", suggestedUrgency);
      if (suggestedWorkflow) fd.set("suggestedWorkflow", suggestedWorkflow);
      if (locationText.trim()) fd.set("locationText", locationText.trim());
      for (const file of photos) fd.append("photos", file);
      if (visionInsight?.analysisId) {
        fd.set("visionAnalysisId", visionInsight.analysisId);
      }
      if (voiceInsight?.transcriptId) {
        fd.set("voiceTranscriptId", voiceInsight.transcriptId);
      }
      if (voiceInsight?.audioBlob) {
        fd.set(
          "voiceAudio",
          new File([voiceInsight.audioBlob], "intent-voice.webm", {
            type: voiceInsight.audioBlob.type || "audio/webm",
          }),
        );
      }

      const result = await publishIntentRequestAction(fd);
      if (!result.success || !result.requestId) {
        if (result.error === "login_required") {
          window.location.href = loginHref;
          return;
        }
        setError(resolveError(result.error));
        return;
      }
      router.push(`/request/${result.requestId}/waiting`);
    });
  }

  function onCategoryChange(nextId: string) {
    setCategoryId(nextId);
    const slug = categories.find((c) => c.id === nextId)?.slug;
    setLiveCategorySlug(slug ?? null);
    loadClarifyForCategory(slug);
  }

  function onPhotosChange(files: File[]) {
    setPhotos(files);
    void runVisionOnPhotos(files);
  }

  function confirmVision() {
    setVisionInsight((prev) => (prev ? { ...prev, confirmed: true } : prev));
    if (visionInsight?.analysisId) {
      void confirmIntentVisionAction({
        analysisId: visionInsight.analysisId,
        confirmed: true,
      });
    }
  }

  function saveVisionCorrection() {
    setVisionInsight((prev) => (prev ? { ...prev, confirmed: false } : prev));
    setShowVisionCorrection(false);
    if (visionInsight?.analysisId) {
      void confirmIntentVisionAction({
        analysisId: visionInsight.analysisId,
        confirmed: false,
        correction: visionCorrection,
      });
    }
  }

  const stepIndex = (
    ["intent", "confirm", "category", "clarify", "photos", "location", "urgency", "publish"] as Step[]
  ).indexOf(step);

  const clarifyBackStep: Step =
    suggestion?.confidence && suggestion.confidence >= HIGH_CONFIDENCE
      ? "confirm"
      : "category";

  const photosBackStep: Step = clarifyNotes.length ? "clarify" : "category";

  return {
    t,
    locale,
    pending,
    step,
    setStep,
    stepIndex,
    error,
    intentText,
    setIntentText,
    suggestion,
    categories,
    categoryId,
    suggestedCategorySlug,
    photos,
    visionInsight,
    visionPending,
    visionError,
    showVisionCorrection,
    setShowVisionCorrection,
    visionCorrection,
    setVisionCorrection,
    setVoiceInsight,
    cityId,
    setCityId,
    locationText,
    setLocationText,
    urgency,
    setUrgency,
    clarifyNotes,
    clarifyAnswers,
    setClarifyAnswers,
    aiQuestions,
    completenessScore,
    suggestions,
    categoryLabel,
    cityLabel,
    cities,
    isAuthenticated,
    voiceEnabled,
    goSuggest,
    acceptSuggestion,
    rejectSuggestion,
    afterCategory,
    afterClarify,
    afterPhotos,
    afterLocation,
    publish,
    onCategoryChange,
    onPhotosChange,
    confirmVision,
    saveVisionCorrection,
    clarifyBackStep,
    photosBackStep,
  };
}
