"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceWaveform } from "@/components/search/voice-waveform";
import {
  VoiceRecorder,
  VoiceRecorderError,
  MAX_CHAT_VOICE_RECORDING_MS,
} from "@/lib/voice/recorder";
import { sendChatVoiceMessageAction } from "@/actions/chat-voice.actions";
import { cn } from "@/lib/utils";

type Status =
  | "idle"
  | "permission"
  | "recording"
  | "paused"
  | "sending"
  | "error";

type Props = {
  conversationId: string;
  disabled?: boolean;
  onSent?: () => void;
  className?: string;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function VoiceMessageRecorder({
  conversationId,
  disabled,
  onSent,
  className,
}: Props) {
  const t = useTranslations("messaging.voice");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const frameRef = useRef<number | null>(null);
  const finishRef = useRef<(() => Promise<void>) | null>(null);
  const elapsedRef = useRef(0);

  const stopFrameLoop = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => () => stopFrameLoop(), [stopFrameLoop]);

  const startFrameLoop = useCallback(() => {
    stopFrameLoop();
    const tick = () => {
      const rec = recorderRef.current;
      if (!rec) return;
      const elapsed = rec.getElapsedMs();
      elapsedRef.current = elapsed;
      setElapsedMs(elapsed);
      setLevel(rec.getLevel());
      if (elapsed >= rec.getMaxMs()) {
        void finishRef.current?.();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [stopFrameLoop]);

  const cancel = useCallback(() => {
    stopFrameLoop();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setStatus("idle");
    setExpanded(false);
    setElapsedMs(0);
    setLevel(0);
    setError(null);
  }, [stopFrameLoop]);

  const finishAndSend = useCallback(async () => {
    stopFrameLoop();
    const recorder = recorderRef.current;
    if (!recorder) return;
    setStatus("sending");
    const blob = await recorder.stop();
    recorderRef.current = null;
    const durationMs = elapsedRef.current || Math.round(blob.size / 100);

    if (blob.size === 0) {
      setError("no_audio");
      setStatus("error");
      return;
    }

    const fd = new FormData();
    fd.set("conversationId", conversationId);
    fd.set("durationMs", String(durationMs));
    fd.set("audio", blob, "voice-message.webm");

    const result = await sendChatVoiceMessageAction(fd);
    if (!result.success) {
      setError(result.error ?? "send_failed");
      setStatus("error");
      return;
    }

    setStatus("idle");
    setExpanded(false);
    setElapsedMs(0);
    setLevel(0);
    onSent?.();
  }, [conversationId, onSent, stopFrameLoop]);

  finishRef.current = finishAndSend;

  const start = async () => {
    setError(null);
    setExpanded(true);
    setStatus("permission");
    try {
      const recorder = new VoiceRecorder({ maxMs: MAX_CHAT_VOICE_RECORDING_MS });
      await recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
      startFrameLoop();
    } catch (err) {
      const reason =
        err instanceof VoiceRecorderError ? err.reason : "unknown";
      setError(reason);
      setStatus("error");
    }
  };

  const pause = () => {
    recorderRef.current?.pause();
    setStatus("paused");
  };

  const resume = () => {
    recorderRef.current?.resume();
    setStatus("recording");
  };

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("size-11 rounded-2xl", className)}
        disabled={disabled}
        aria-label={t("record")}
        onClick={() => void start()}
      >
        <Mic className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="mb-2 space-y-2 rounded-2xl border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">
          {status === "paused" ? t("paused") : t("recording")}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatTime(elapsedMs)}
        </span>
      </div>
      <VoiceWaveform level={level} />
      <div className="flex flex-wrap items-center gap-1.5">
        {status === "recording" ? (
          <Button type="button" size="sm" variant="outline" onClick={pause}>
            <Pause className="me-1 size-3.5" />
            {t("pause")}
          </Button>
        ) : null}
        {status === "paused" ? (
          <Button type="button" size="sm" variant="outline" onClick={resume}>
            <Play className="me-1 size-3.5" />
            {t("resume")}
          </Button>
        ) : null}
        {(status === "recording" || status === "paused") && (
          <Button type="button" size="sm" onClick={() => void finishAndSend()}>
            <Send className="me-1 size-3.5" />
            {t("send")}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={cancel}>
          {status === "sending" ? (
            <Square className="size-3.5" />
          ) : (
            <Trash2 className="me-1 size-3.5" />
          )}
          {t("cancel")}
        </Button>
      </div>
      {status === "sending" ? (
        <p className="text-[11px] text-muted-foreground">{t("sending")}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
        {t(`errors.${error}` as "errors.unknown")}
      </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">{t("noCalls")}</p>
    </div>
  );
}
