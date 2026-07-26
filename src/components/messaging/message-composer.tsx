"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, MapPin, Paperclip, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { sendChatMessageAction } from "@/actions/chat.actions";
import {
  finalizeChatMediaUploadAction,
  prepareChatMediaUploadAction,
} from "@/actions/media.actions";
import { compressImageFile } from "@/lib/media/compress-image";
import { MEDIA_ACCEPT_ATTR } from "@/lib/media/mime";
import { putFileToStorage } from "@/lib/supabase/direct-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceMessageRecorder } from "@/components/messaging/voice-message-recorder";
import { isChatVoiceMessagingEnabledClient } from "@/lib/config/feature-flags-client";
import { cn } from "@/lib/utils";

type UploadItem = {
  localId: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
  abort?: AbortController;
};

type Props = {
  conversationId: string;
  onTyping?: () => void;
  disabled?: boolean;
  replyTo?: { messageId: string; preview: string } | null;
  onClearReply?: () => void;
  draftText?: string | null;
  onDraftConsumed?: () => void;
};

export function MessageComposer({
  conversationId,
  onTyping,
  disabled,
  replyTo,
  onClearReply,
  draftText,
  onDraftConsumed,
}: Props) {
  const t = useTranslations("messaging.composer");
  const tm = useTranslations("messaging.media");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceEnabled = isChatVoiceMessagingEnabledClient();

  useEffect(() => {
    if (draftText == null || draftText === "") return;
    setBody(draftText);
    onDraftConsumed?.();
  }, [draftText, onDraftConsumed]);

  const updateUpload = useCallback((localId: string, patch: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((u) => (u.localId === localId ? { ...u, ...patch } : u)),
    );
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next = Array.from(files).map((file) => ({
      localId: crypto.randomUUID(),
      file,
      progress: 0,
      status: "queued" as const,
    }));
    if (!next.length) return;
    setUploads((prev) => [...prev, ...next].slice(0, 8));
  }, []);

  const cancelUpload = (localId: string) => {
    setUploads((prev) => {
      const item = prev.find((u) => u.localId === localId);
      item?.abort?.abort();
      return prev.map((u) =>
        u.localId === localId ? { ...u, status: "cancelled", progress: 0 } : u,
      );
    });
  };

  const removeUpload = (localId: string) => {
    cancelUpload(localId);
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  };

  const uploadOne = async (item: UploadItem, bodyText: string, replyId: string | null) => {
    const abort = new AbortController();
    updateUpload(item.localId, { status: "uploading", abort, progress: 0.02 });

    let file = item.file;
    if (file.type.startsWith("image/")) {
      const compressed = await compressImageFile(file, {
        maxEdge: 1600,
        quality: 0.8,
      });
      file = compressed.file;
    }

    const slot = await prepareChatMediaUploadAction({
      conversationId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });

    if (!slot.success) {
      updateUpload(item.localId, {
        status: "error",
        error: slot.error ?? "prepare_failed",
      });
      return false;
    }

    const put = await putFileToStorage({
      bucket: slot.bucket,
      path: slot.path,
      token: slot.token ?? undefined,
      signedUrl: slot.signedUrl ?? undefined,
      file,
      mimeType: file.type || "application/octet-stream",
      signal: abort.signal,
      onPercent: (ratio) => updateUpload(item.localId, { progress: ratio }),
    });

    if (!put.ok) {
      updateUpload(item.localId, {
        status: put.error === "cancelled" ? "cancelled" : "error",
        error: put.error,
      });
      return false;
    }

    const finalized = await finalizeChatMediaUploadAction({
      conversationId,
      path: slot.path,
      bucket: slot.bucket,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      bodyText,
      replyToMessageId: replyId,
      clientId: crypto.randomUUID(),
    });

    if (!finalized.success) {
      updateUpload(item.localId, { status: "error", error: finalized.error });
      return false;
    }

    updateUpload(item.localId, { status: "done", progress: 1 });
    return true;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    const active = uploads.filter((u) => u.status === "queued" || u.status === "error");
    if (!text && !active.length && !uploads.some((u) => u.status === "queued")) return;

    setError(null);
    startTransition(async () => {
      const toUpload = uploads.filter(
        (u) => u.status === "queued" || u.status === "error",
      );
      const replyId = replyTo?.messageId ?? null;

      if (toUpload.length) {
        let first = true;
        for (const item of toUpload) {
          const ok = await uploadOne(item, first ? text : "", first ? replyId : null);
          if (!ok && item.status !== "cancelled") setError("send_failed");
          first = false;
        }
        setBody("");
        onClearReply?.();
        setUploads((prev) => prev.filter((u) => u.status !== "done"));
        router.refresh();
        return;
      }

      // text-only (or legacy single path without queued files)
      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("bodyText", text);
      fd.set("clientId", crypto.randomUUID());
      if (replyId) fd.set("replyToMessageId", replyId);
      const result = await sendChatMessageAction(fd);
      if (result.success) {
        setBody("");
        onClearReply?.();
        router.refresh();
      } else {
        setError(result.error ?? "send_failed");
      }
    });
  };

  const retry = (localId: string) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.localId === localId
          ? { ...u, status: "queued", progress: 0, error: undefined }
          : u,
      ),
    );
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setError("location_unavailable");
      return;
    }
    setError(null);
    startTransition(async () => {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const fd = new FormData();
            fd.set("conversationId", conversationId);
            fd.set("bodyText", "");
            fd.set("locationLat", String(pos.coords.latitude));
            fd.set("locationLng", String(pos.coords.longitude));
            fd.set("locationLabel", t("locationShared"));
            const result = await sendChatMessageAction(fd);
            if (!result.success) setError(result.error ?? "send_failed");
            else router.refresh();
            resolve();
          },
          () => {
            setError("location_denied");
            resolve();
          },
          { enableHighAccuracy: false, timeout: 10_000 },
        );
      });
    });
  };

  const canSend =
    Boolean(body.trim()) ||
    uploads.some((u) => u.status === "queued" || u.status === "error");

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-border px-4 py-3"
      noValidate
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData?.files ?? []);
        if (files.length) {
          e.preventDefault();
          addFiles(files);
        }
      }}
    >
      {dragOver ? (
        <div className="mb-2 rounded-xl border border-dashed border-[var(--dalily-gold)] bg-[var(--dalily-gold)]/10 px-3 py-4 text-center text-xs text-muted-foreground">
          {tm("dropHere")}
        </div>
      ) : null}

      {replyTo ? (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{t("replying")}</p>
            <p className="truncate text-muted-foreground">{replyTo.preview}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-8"
            onClick={() => onClearReply?.()}
          >
            {t("cancelReply")}
          </Button>
        </div>
      ) : null}

      {uploads.length ? (
        <ul className="mb-2 space-y-1.5">
          {uploads.map((u) => (
            <li
              key={u.localId}
              className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{u.file.name}</span>
                <div className="flex shrink-0 items-center gap-1">
                  {u.status === "error" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-7 px-2"
                      onClick={() => retry(u.localId)}
                    >
                      {tm("retry")}
                    </Button>
                  ) : null}
                  {u.status === "uploading" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-7 px-2"
                      onClick={() => cancelUpload(u.localId)}
                    >
                      {tm("cancel")}
                    </Button>
                  ) : (
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-muted"
                      onClick={() => removeUpload(u.localId)}
                      aria-label={t("removeFile")}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    u.status === "error"
                      ? "bg-destructive"
                      : u.status === "cancelled"
                        ? "bg-muted-foreground/40"
                        : "bg-[var(--dalily-gold)]",
                  )}
                  style={{ width: `${Math.round(u.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {u.status === "uploading"
                  ? tm("progress", { pct: Math.round(u.progress * 100) })
                  : u.status === "error"
                    ? tm("failed")
                    : u.status === "cancelled"
                      ? tm("cancelled")
                      : u.status === "done"
                        ? tm("done")
                        : tm("queued")}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {voiceEnabled ? (
        <VoiceMessageRecorder
          conversationId={conversationId}
          disabled={pending || disabled}
          onSent={() => router.refresh()}
        />
      ) : null}

      <div className="flex gap-2">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-2xl"
            disabled={pending || disabled}
            aria-label={t("attach")}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-2xl"
            disabled={pending || disabled}
            aria-label={t("shareLocation")}
            onClick={shareLocation}
          >
            <MapPin className="size-4" aria-hidden />
          </Button>
        </div>
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            onTyping?.();
          }}
          placeholder={t("placeholder")}
          rows={2}
          maxLength={4000}
          disabled={pending || disabled}
          className="min-h-[5.5rem] flex-1 resize-none rounded-2xl"
          aria-label={t("placeholder")}
        />
        <Button
          type="submit"
          size="icon"
          className={cn("size-11 shrink-0 self-end rounded-2xl")}
          disabled={pending || disabled || !canSend}
          aria-label={t("send")}
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="sr-only"
        accept={MEDIA_ACCEPT_ATTR}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <ImagePlus className="size-3.5" aria-hidden />
        {t("attachHint")}
      </p>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {t("error")}
        </p>
      ) : null}
    </form>
  );
}
