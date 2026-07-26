"use client";

/**
 * Intent intake voice recorder + AI interpretation panel.
 */

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Mic, Square, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  VoiceRecorder,
  VoiceRecorderError,
  MAX_RECORDING_MS,
} from "@/lib/voice/recorder";
import {
  analyzeIntentVoiceAction,
  confirmIntentVoiceAction,
} from "@/actions/intent-voice.actions";

export type IntentVoiceInsight = {
  transcriptId: string | null;
  originalTranscript: string;
  normalizedTranscript: string;
  categorySlug: string | null;
  urgency: string;
  summaryEn: string;
  summaryAr: string;
  contradiction: boolean;
  language: string;
  dialect: string;
  confirmed: boolean | null;
  audioBlob: Blob | null;
};

type Props = {
  enabled: boolean;
  typedText: string;
  categorySlug?: string;
  onInsight: (insight: IntentVoiceInsight | null) => void;
  onTranscriptApply: (normalized: string) => void;
};

export function IntentVoiceCapture({
  enabled,
  typedText,
  categorySlug,
  onInsight,
  onTranscriptApply,
}: Props) {
  const t = useTranslations("intentFlow.steps.voice");
  const locale = useLocale();
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const [status, setStatus] = useState<
    "idle" | "recording" | "transcribing" | "ready" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<IntentVoiceInsight | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void recorderRef.current?.cancel();
    };
  }, []);

  if (!enabled) return null;

  async function startRecording() {
    setError(null);
    setInsight(null);
    onInsight(null);
    const recorder = new VoiceRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      setStatus("recording");
      timerRef.current = setTimeout(() => {
        void stopRecording();
      }, MAX_RECORDING_MS);
    } catch (err) {
      setStatus("error");
      if (err instanceof VoiceRecorderError) {
        setError(t(`errors.${err.reason}`));
      } else {
        setError(t("errors.unknown"));
      }
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (!recorder) return;
    setStatus("transcribing");
    try {
      const blob = await recorder.stop();
      const fd = new FormData();
      fd.set("audio", blob, "intent-voice.webm");
      if (typedText.trim()) fd.set("typedText", typedText.trim());
      if (categorySlug) fd.set("categorySlug", categorySlug);

      const result = await analyzeIntentVoiceAction(fd);
      if (!result.success) {
        setStatus("error");
        setError(t(`errors.${result.error}`));
        return;
      }

      const next: IntentVoiceInsight = {
        transcriptId: result.transcriptId,
        originalTranscript: result.originalTranscript,
        normalizedTranscript: result.normalizedTranscript,
        categorySlug: result.categorySlug,
        urgency: result.urgency,
        summaryEn: result.summaryEn,
        summaryAr: result.summaryAr,
        contradiction: result.contradiction,
        language: result.language.language,
        dialect: result.language.dialect,
        confirmed: null,
        audioBlob: blob,
      };
      setInsight(next);
      onInsight(next);
      onTranscriptApply(result.normalizedTranscript);
      setEditText(result.normalizedTranscript);
      setStatus("ready");
    } catch {
      setStatus("error");
      setError(t("errors.transcription_failed"));
    }
  }

  async function cancelRecording() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await recorderRef.current?.cancel();
    setStatus("idle");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "recording" && status !== "transcribing" ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => void startRecording()}
          >
            <Mic className="size-4 me-1.5" aria-hidden />
            {t("record")}
          </Button>
        ) : null}
        {status === "recording" ? (
          <>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void stopRecording()}
            >
              <Square className="size-3.5 me-1.5 fill-current" aria-hidden />
              {t("stop")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={() => void cancelRecording()}
            >
              {t("cancel")}
            </Button>
            <span className="text-xs text-muted-foreground animate-pulse">
              {t("recording")}
            </span>
          </>
        ) : null}
        {status === "transcribing" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("transcribing")}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {insight && status === "ready" ? (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("aiSummary")}
          </p>
          {editing ? (
            <Textarea
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="rounded-xl"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {insight.normalizedTranscript}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {locale === "ar" ? insight.summaryAr : insight.summaryEn}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">{t("category")}</dt>
              <dd className="font-medium">
                {insight.categorySlug?.replace(/_/g, " ") ?? t("unknownCategory")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("urgency")}</dt>
              <dd className="font-medium capitalize">{insight.urgency}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("language")}</dt>
              <dd className="font-medium">
                {insight.language}
                {insight.dialect !== "unknown" ? ` · ${insight.dialect}` : ""}
              </dd>
            </div>
          </dl>
          {insight.contradiction && insight.confirmed == null ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("clarifyMismatch")}
            </p>
          ) : null}
          {insight.confirmed === true ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5" aria-hidden />
              {t("confirmed")}
            </p>
          ) : null}
          {insight.confirmed == null && !editing ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setInsight((prev) =>
                    prev ? { ...prev, confirmed: true } : prev,
                  );
                  onInsight(
                    insight ? { ...insight, confirmed: true } : insight,
                  );
                  if (insight.transcriptId) {
                    void confirmIntentVoiceAction({
                      transcriptId: insight.transcriptId,
                      confirmed: true,
                      finalCategorySlug: insight.categorySlug ?? undefined,
                    });
                  }
                }}
              >
                {t("confirm")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5 me-1" aria-hidden />
                {t("editTranscript")}
              </Button>
            </div>
          ) : null}
          {editing ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  const next = insight
                    ? {
                        ...insight,
                        normalizedTranscript: editText.trim(),
                        confirmed: false,
                      }
                    : null;
                  setInsight(next);
                  onInsight(next);
                  if (editText.trim()) onTranscriptApply(editText.trim());
                  setEditing(false);
                  if (insight?.transcriptId) {
                    void confirmIntentVoiceAction({
                      transcriptId: insight.transcriptId,
                      confirmed: false,
                      editedTranscript: editText.trim(),
                      finalCategorySlug: insight.categorySlug ?? undefined,
                    });
                  }
                }}
              >
                {t("saveEdit")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setEditing(false)}
              >
                {t("cancelEdit")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
