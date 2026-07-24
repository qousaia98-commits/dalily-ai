"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Search, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  VoiceSearchButton,
  isVoiceBusy,
  type VoiceStatus,
} from "@/components/search/voice-search-button";
import {
  VisionUploadControl,
  type VisionUploadHandle,
} from "@/components/search/vision-upload-control";
import { DiagnosisWizard } from "@/components/search/diagnosis-wizard";
import { detectDiagnosisAction } from "@/actions/diagnosis.actions";
import { URGENCY_PARAM } from "@/lib/diagnosis/url";
import type { DiagnosisResult } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

type SearchFormProps = {
  defaultQuery?: string;
  className?: string;
  size?: "default" | "compact";
  autoFocus?: boolean;
};

export function SearchForm({
  defaultQuery = "",
  className,
  size = "default",
  autoFocus = false,
}: SearchFormProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [error, setError] = useState<string | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState<string | null>(null);
  const [fromVision, setFromVision] = useState(false);
  const [mode, setMode] = useState<"input" | "wizard">("input");
  const [activeProblemId, setActiveProblemId] = useState<ProblemId | null>(null);
  const [checking, startChecking] = useTransition();
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [hasVisionImage, setHasVisionImage] = useState(false);
  const visionRef = useRef<VisionUploadHandle>(null);

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  const isCompact = size === "compact";
  const voiceBusy = isVoiceBusy(voiceStatus);
  const showCompanionActions = voiceStatus === "idle" || voiceStatus === "ready";

  function navigate(trimmed: string, urgencyOverride?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", trimmed);
    if (voiceLanguage) {
      params.set("voice", "1");
      params.set("lang", voiceLanguage);
      setVoiceLanguage(null);
    } else {
      params.delete("voice");
      params.delete("lang");
    }
    if (fromVision) {
      params.set("vision", "1");
      setFromVision(false);
    } else {
      params.delete("vision");
    }
    if (urgencyOverride) {
      params.set(URGENCY_PARAM, urgencyOverride);
    } else {
      params.delete(URGENCY_PARAM);
    }
    router.push(`/search?${params.toString()}`);
  }

  function enterPipeline(trimmed: string, options?: { skipDiagnosis?: boolean; urgency?: string }) {
    setError(null);
    startChecking(async () => {
      if (options?.skipDiagnosis && options.urgency) {
        navigate(trimmed, options.urgency);
        return;
      }

      const detection = await detectDiagnosisAction(trimmed);
      if (detection) {
        setActiveProblemId(detection.problemId);
        setMode("wizard");
      } else {
        navigate(trimmed, options?.urgency);
      }
    });
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setError(t("errors.tooShort"));
      return;
    }
    if (trimmed.length > MAX_QUERY_LENGTH) {
      setError(t("errors.tooLong"));
      return;
    }

    setFromVision(false);
    enterPipeline(trimmed);
  };

  if (mode === "wizard" && activeProblemId) {
    return (
      <div className={cn("w-full", className)}>
        <DiagnosisWizard
          problemId={activeProblemId}
          onExit={() => setMode("input")}
          onSkip={() => {
            setMode("input");
            navigate(query.trim());
          }}
          onComplete={(result: DiagnosisResult) => navigate(query.trim(), result.urgency)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full space-y-4", className)} noValidate>
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFromVision(false);
            if (error) setError(null);
          }}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "search-error" : undefined}
          maxLength={MAX_QUERY_LENGTH}
          autoFocus={autoFocus}
          disabled={voiceBusy}
          className={cn(
            "rounded-2xl border-border/80 bg-card ps-12 pe-4 shadow-lg shadow-primary/5 transition-shadow focus-visible:shadow-xl focus-visible:shadow-primary/10",
            isCompact ? "h-12 text-base" : "h-14 text-base sm:h-16 sm:text-lg",
          )}
        />
        {error ? (
          <p id="search-error" role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <VisionUploadControl
        ref={visionRef}
        toolbarMode
        autoAnalyze={false}
        compact={isCompact}
        onImageChange={setHasVisionImage}
        onError={(message) => setError(message)}
        onAnalyzed={({ decision, diagnosisProblemId }) => {
          setFromVision(true);
          setVoiceLanguage(null);
          setQuery(decision.queryText);
          setError(null);

          if (decision.skipDiagnosis && decision.urgencyOverride) {
            enterPipeline(decision.queryText, {
              skipDiagnosis: true,
              urgency: decision.urgencyOverride,
            });
            return;
          }

          if (diagnosisProblemId) {
            setActiveProblemId(diagnosisProblemId);
            setMode("wizard");
            return;
          }

          enterPipeline(decision.queryText, {
            urgency: decision.urgencyOverride ?? undefined,
          });
        }}
      />

      {/* Camera · Voice · Search — voice expands in-place to recording panel (same instance) */}
      <div
        className={cn(
          "flex gap-2",
          showCompanionActions ? "flex-col sm:flex-row sm:items-stretch" : "flex-col",
        )}
      >
        {showCompanionActions ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-12 flex-1 gap-2 rounded-2xl sm:flex-none sm:px-5"
            disabled={checking || hasVisionImage}
            onClick={() => visionRef.current?.openCamera()}
            aria-label={t("vision.camera")}
          >
            <Camera className="size-5" aria-hidden />
            {t("actions.camera")}
          </Button>
        ) : null}

        <VoiceSearchButton
          toolbar
          className={cn(showCompanionActions ? "flex-1 sm:flex-none" : "w-full")}
          onStatusChange={setVoiceStatus}
          onTranscript={(text, language) => {
            setQuery(text);
            setVoiceLanguage(language);
            setFromVision(false);
            if (error) setError(null);
          }}
        />

        {showCompanionActions ? (
          <Button
            type="submit"
            size="lg"
            disabled={checking}
            className="min-h-12 flex-1 gap-2 rounded-2xl px-8 font-semibold shadow-lg shadow-primary/20 sm:flex-none"
          >
            {checking ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-5" aria-hidden />
            )}
            {t("actions.search")}
          </Button>
        ) : null}
      </div>

      {hasVisionImage && showCompanionActions ? (
        <p className="text-center text-xs text-muted-foreground sm:text-start">
          {t("vision.previewHint")}
        </p>
      ) : null}
    </form>
  );
}
