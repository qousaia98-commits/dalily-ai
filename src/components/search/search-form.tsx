"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceSearchButton } from "@/components/search/voice-search-button";
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
  const [mode, setMode] = useState<"input" | "wizard">("input");
  const [activeProblemId, setActiveProblemId] = useState<ProblemId | null>(null);
  const [checking, startChecking] = useTransition();

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  const isCompact = size === "compact";

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
    if (urgencyOverride) {
      params.set(URGENCY_PARAM, urgencyOverride);
    } else {
      params.delete(URGENCY_PARAM);
    }
    router.push(`/search?${params.toString()}`);
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

    setError(null);
    startChecking(async () => {
      const detection = await detectDiagnosisAction(trimmed);
      if (detection) {
        setActiveProblemId(detection.problemId);
        setMode("wizard");
      } else {
        navigate(trimmed);
      }
    });
  };

  if (mode === "wizard" && activeProblemId) {
    return (
      <div className={cn("w-full", className)}>
        <DiagnosisWizard
          problemId={activeProblemId}
          onExit={() => setMode("input")}
          onComplete={(result: DiagnosisResult) => navigate(query.trim(), result.urgency)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (error) setError(null);
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "search-error" : undefined}
            maxLength={MAX_QUERY_LENGTH}
            autoFocus={autoFocus}
            className={cn(
              "rounded-2xl border-border/80 bg-card ps-12 pe-14 shadow-lg shadow-primary/5 transition-shadow focus-visible:shadow-xl focus-visible:shadow-primary/10",
              isCompact ? "h-12 text-base" : "h-14 text-base sm:h-16 sm:text-lg",
            )}
          />
          <VoiceSearchButton
            className="absolute end-2 top-1/2 -translate-y-1/2"
            onTranscript={(text, language) => {
              setQuery(text);
              setVoiceLanguage(language);
              if (error) setError(null);
            }}
          />
          {error ? (
            <p id="search-error" role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={checking}
          className={cn(
            "w-full rounded-2xl px-8 font-semibold shadow-lg shadow-primary/20 sm:w-auto",
            isCompact ? "h-12 text-base" : "h-14 text-base sm:h-16",
          )}
        >
          {checking ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-5" />
          )}
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
