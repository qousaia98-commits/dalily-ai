"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mic, RotateCcw, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceWaveform } from "@/components/search/voice-waveform";
import { VoiceRecorder, VoiceRecorderError, MAX_RECORDING_MS } from "@/lib/voice/recorder";
import { transcribeVoiceQueryAction } from "@/actions/voice.actions";
import { cn } from "@/lib/utils";

export type VoiceStatus =
  | "idle"
  | "permission"
  | "recording"
  | "transcribing"
  | "ready"
  | "error";

type ErrorReason =
  | "permission_denied"
  | "not_supported"
  | "no_audio"
  | "file_too_large"
  | "invalid_file_type"
  | "transcription_failed";

type Props = {
  onTranscript: (text: string, language: string | null) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  /** Idle trigger button className */
  className?: string;
  /** Larger touch target for toolbar layout */
  toolbar?: boolean;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function VoiceSearchButton({
  onTranscript,
  onStatusChange,
  className,
  toolbar = false,
}: Props) {
  const t = useTranslations("search.voice");
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorReason, setErrorReason] = useState<ErrorReason>("transcription_failed");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const frameRef = useRef<number | null>(null);

  const updateStatus = useCallback(
    (next: VoiceStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const stopFrameLoop = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => stopFrameLoop, [stopFrameLoop]);

  const finishRecording = useCallback(async () => {
    stopFrameLoop();
    const recorder = recorderRef.current;
    if (!recorder) return;

    updateStatus("transcribing");
    const blob = await recorder.stop();
    recorderRef.current = null;

    if (blob.size === 0) {
      setErrorReason("no_audio");
      updateStatus("error");
      return;
    }

    const formData = new FormData();
    formData.set("audio", blob, "voice-query.webm");
    const result = await transcribeVoiceQueryAction(formData);

    if (!result.success) {
      setErrorReason(result.error);
      updateStatus("error");
      return;
    }

    onTranscript(result.text, result.language);
    updateStatus("ready");
  }, [onTranscript, stopFrameLoop, updateStatus]);

  const runFrameLoop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    const elapsed = recorder.getElapsedMs();
    setLevel(recorder.getLevel());
    setElapsedMs(elapsed);

    if (elapsed >= MAX_RECORDING_MS) {
      void finishRecording();
      return;
    }
    frameRef.current = requestAnimationFrame(runFrameLoop);
  }, [finishRecording]);

  const startRecording = useCallback(async () => {
    updateStatus("permission");
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
    } catch (error) {
      const reason: ErrorReason =
        error instanceof VoiceRecorderError && error.reason !== "unknown"
          ? error.reason
          : "transcription_failed";
      setErrorReason(reason);
      updateStatus("error");
      return;
    }

    recorderRef.current = recorder;
    setElapsedMs(0);
    updateStatus("recording");
    frameRef.current = requestAnimationFrame(runFrameLoop);
  }, [runFrameLoop, updateStatus]);

  const cancelRecording = useCallback(() => {
    stopFrameLoop();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    updateStatus("idle");
  }, [stopFrameLoop, updateStatus]);

  if (status === "idle" || status === "permission") {
    return (
      <Button
        type="button"
        size={toolbar ? "lg" : "icon"}
        variant={toolbar ? "outline" : "ghost"}
        className={cn(
          toolbar
            ? "min-h-12 flex-1 gap-2 rounded-2xl sm:flex-none sm:px-5"
            : "size-10 rounded-2xl text-muted-foreground",
          className,
        )}
        disabled={status === "permission"}
        onClick={() => void startRecording()}
        aria-label={t("start")}
      >
        {status === "permission" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Mic className="size-5" aria-hidden />
        )}
        {toolbar ? <span>{t("startShort")}</span> : null}
      </Button>
    );
  }

  // Dedicated recording / status panel — never overlays the search field
  return (
    <div
      className="w-full rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
      role="status"
      aria-live="polite"
    >
      {status === "recording" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{t("recordingTitle")}</p>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {formatTime(elapsedMs)}
            </span>
          </div>
          <VoiceWaveform level={level} className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 flex-1 gap-2 rounded-2xl sm:flex-none"
              onClick={cancelRecording}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("delete")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 flex-1 gap-2 rounded-2xl sm:flex-none"
              onClick={() => void finishRecording()}
              aria-label={t("stop")}
            >
              <Square className="size-4" aria-hidden />
              {t("stop")}
            </Button>
            <Button
              type="button"
              className="min-h-12 flex-1 gap-2 rounded-2xl sm:flex-none"
              onClick={() => void finishRecording()}
            >
              <Send className="size-4" aria-hidden />
              {t("send")}
            </Button>
          </div>
        </div>
      ) : null}

      {status === "transcribing" ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("transcribing")}
        </p>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-destructive">
            {t(`errors.${errorReason}` as "errors.transcription_failed")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2 rounded-2xl"
            onClick={() => updateStatus("idle")}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("recordAgain")}
          </Button>
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("editHint")}</p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 gap-1.5 rounded-2xl"
            onClick={() => void startRecording()}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t("recordAgain")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function isVoiceBusy(status: VoiceStatus): boolean {
  return status === "permission" || status === "recording" || status === "transcribing";
}
