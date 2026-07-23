"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceWaveform } from "@/components/search/voice-waveform";
import { VoiceRecorder, VoiceRecorderError, MAX_RECORDING_MS } from "@/lib/voice/recorder";
import { transcribeVoiceQueryAction } from "@/actions/voice.actions";
import { cn } from "@/lib/utils";

type Status = "idle" | "permission" | "recording" | "transcribing" | "ready" | "error";
type ErrorReason =
  | "permission_denied"
  | "not_supported"
  | "no_audio"
  | "file_too_large"
  | "invalid_file_type"
  | "transcription_failed";

type Props = {
  onTranscript: (text: string, language: string | null) => void;
  className?: string;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function VoiceSearchButton({ onTranscript, className }: Props) {
  const t = useTranslations("search.voice");
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<ErrorReason>("transcription_failed");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const frameRef = useRef<number | null>(null);

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

    setStatus("transcribing");
    const blob = await recorder.stop();
    recorderRef.current = null;

    console.log("[voice] recorded blob:", { size: blob.size, type: blob.type });

    if (blob.size === 0) {
      console.error("[voice] recording produced an empty blob — mic captured no audio data");
      setErrorReason("no_audio");
      setStatus("error");
      return;
    }

    const formData = new FormData();
    formData.set("audio", blob, "voice-query.webm");

    console.log("[voice] calling transcribeVoiceQueryAction...");
    const result = await transcribeVoiceQueryAction(formData);
    console.log("[voice] transcribeVoiceQueryAction result:", result);

    if (!result.success) {
      setErrorReason(result.error);
      setStatus("error");
      return;
    }

    onTranscript(result.text, result.language);
    setStatus("ready");
  }, [onTranscript, stopFrameLoop]);

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
    console.log("[voice] mic clicked — requesting getUserMedia permission");
    setStatus("permission");
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
    } catch (error) {
      console.error("[voice] recorder.start() failed:", error);
      const reason: ErrorReason =
        error instanceof VoiceRecorderError && error.reason !== "unknown"
          ? error.reason
          : "transcription_failed";
      setErrorReason(reason);
      setStatus("error");
      return;
    }

    console.log("[voice] recording started");
    recorderRef.current = recorder;
    setElapsedMs(0);
    setStatus("recording");
    frameRef.current = requestAnimationFrame(runFrameLoop);
  }, [runFrameLoop]);

  const cancelRecording = useCallback(() => {
    stopFrameLoop();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setStatus("idle");
  }, [stopFrameLoop]);

  if (status === "idle" || status === "permission") {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("size-10 rounded-2xl text-muted-foreground", className)}
        disabled={status === "permission"}
        onClick={() => void startRecording()}
        aria-label={t("start")}
      >
        {status === "permission" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Mic className="size-5" aria-hidden />
        )}
      </Button>
    );
  }

  if (status === "recording") {
    return (
      <div className="absolute inset-x-0 top-full z-10 mt-2 flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-lg">
        <VoiceWaveform level={level} className="flex-1" />
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {t("recording", { time: formatTime(elapsedMs) })}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 rounded-xl"
          onClick={cancelRecording}
          aria-label={t("cancel")}
        >
          <X className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          className="size-9 rounded-xl"
          onClick={() => void finishRecording()}
          aria-label={t("done")}
        >
          <Square className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  if (status === "transcribing") {
    return (
      <div className="absolute inset-x-0 top-full z-10 mt-2 flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 text-sm text-muted-foreground shadow-lg">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("transcribing")}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="absolute inset-x-0 top-full z-10 mt-2 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-card p-3 text-sm text-destructive shadow-lg">
        <span className="flex-1">{t(`errors.${errorReason}` as "errors.transcription_failed")}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-xl"
          onClick={() => setStatus("idle")}
          aria-label={t("recordAgain")}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-full z-10 mt-2 flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card p-3 text-sm shadow-lg">
      <span className="text-muted-foreground">{t("editHint")}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="gap-1.5 rounded-xl"
        onClick={() => void startRecording()}
      >
        <RotateCcw className="size-3.5" aria-hidden />
        {t("recordAgain")}
      </Button>
    </div>
  );
}
