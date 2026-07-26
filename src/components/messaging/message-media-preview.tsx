"use client";

import { useState } from "react";
import { Download, Expand, FileText, Pause, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { trackMediaEventAction } from "@/actions/media.actions";
import { trackVoicePlay } from "@/components/messaging/voice-transcript-panel";
import { cn } from "@/lib/utils";

export type MediaAttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  signedUrl?: string | null;
  durationMs?: number | null;
  isPinned?: boolean;
};

type Props = {
  attachments: MediaAttachmentView[];
  conversationId: string;
  mine?: boolean;
};

export function MessageMediaPreview({ attachments, conversationId, mine }: Props) {
  const t = useTranslations("messaging.media");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const images = attachments.filter(
    (a) => a.kind === "image" || a.mimeType.startsWith("image/"),
  );

  if (!attachments.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((att, idx) => {
        const url = att.signedUrl;
        const isImage = att.kind === "image" || att.mimeType.startsWith("image/");
        const isVideo = att.kind === "video" || att.mimeType.startsWith("video/");
        const isAudio =
          att.kind === "voice" ||
          att.kind === "audio" ||
          att.mimeType.startsWith("audio/");
        const isPdf = att.mimeType === "application/pdf";

        if (isImage && url) {
          const imageIndex = images.findIndex((i) => i.id === att.id);
          return (
            <button
              key={att.id}
              type="button"
              className="block overflow-hidden rounded-xl"
              onClick={() => {
                setLightbox(imageIndex >= 0 ? imageIndex : 0);
                void trackMediaEventAction({
                  event: "media_preview_opened",
                  conversationId,
                  attachmentId: att.id,
                });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={att.fileName}
                className="max-h-56 max-w-full object-cover"
              />
            </button>
          );
        }

        if (isVideo && url) {
          return (
            <div key={att.id} className="overflow-hidden rounded-xl">
              <video
                src={url}
                controls
                className="max-h-64 w-full bg-black"
                onPlay={() =>
                  void trackMediaEventAction({
                    event: "media_preview_opened",
                    conversationId,
                    attachmentId: att.id,
                  })
                }
              />
              {att.durationMs ? (
                <p className="mt-0.5 text-[10px] opacity-70">
                  {formatDuration(att.durationMs)}
                </p>
              ) : null}
            </div>
          );
        }

        if (isAudio && url) {
          return (
            <AudioPreview
              key={att.id}
              url={url}
              fileName={att.fileName}
              conversationId={conversationId}
              attachmentId={att.id}
              mine={mine}
            />
          );
        }

        if (isPdf && url) {
          return (
            <div key={att.id} className="space-y-1 rounded-xl border border-white/20 bg-black/10 p-2">
              <iframe
                src={`${url}#page=1`}
                title={att.fileName}
                className="h-48 w-full rounded-lg bg-white"
              />
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 opacity-70" />
                <a
                  href={url}
                  download={att.fileName}
                  className="truncate text-xs underline"
                  onClick={() =>
                    void trackMediaEventAction({
                      event: "media_file_downloaded",
                      conversationId,
                      attachmentId: att.id,
                    })
                  }
                >
                  {t("download")} — {att.fileName}
                </a>
              </div>
            </div>
          );
        }

        return (
          <a
            key={att.id}
            href={url ?? "#"}
            download={att.fileName}
            className={cn(
              "inline-flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs",
              mine ? "border-white/25" : "border-border",
              !url && "pointer-events-none opacity-50",
            )}
            onClick={() =>
              void trackMediaEventAction({
                event: "media_file_downloaded",
                conversationId,
                attachmentId: att.id,
              })
            }
          >
            <Download className="size-3.5 shrink-0" />
            <span className="truncate">{att.fileName}</span>
          </a>
        );
      })}

      {lightbox != null && images[lightbox]?.signedUrl ? (
        <Lightbox
          images={images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      ) : null}
    </div>
  );
}

function AudioPreview({
  url,
  fileName,
  conversationId,
  attachmentId,
  mine,
}: {
  url: string;
  fileName: string;
  conversationId: string;
  attachmentId: string;
  mine?: boolean;
}) {
  const t = useTranslations("messaging.media");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  function toggle() {
    let el = audio;
    if (!el) {
      el = new Audio(url);
      el.playbackRate = speed;
      el.onended = () => setPlaying(false);
      setAudio(el);
    }
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
      void trackMediaEventAction({
        event: "media_voice_played",
        conversationId,
        attachmentId,
      });
      trackVoicePlay(conversationId, attachmentId);
    }
  }

  function cycleSpeed() {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audio) audio.playbackRate = next;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2 py-1.5",
        mine ? "border-white/25" : "border-border",
      )}
    >
      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={toggle}>
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">{fileName}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-current/20">
          <div className="h-full w-2/3 rounded-full bg-current/50" />
        </div>
      </div>
      <Button type="button" size="sm" variant="ghost" className="min-h-8 px-2 text-[10px]" onClick={cycleSpeed}>
        {speed}x
      </Button>
      <span className="sr-only">{t("voice")}</span>
    </div>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: MediaAttachmentView[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const current = images[index];
  if (!current?.signedUrl) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
      <button
        type="button"
        className="absolute start-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-6 text-white"
        onClick={() => onIndex((index - 1 + images.length) % images.length)}
      >
        ‹
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.signedUrl}
        alt={current.fileName}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />
      <button
        type="button"
        className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-6 text-white"
        onClick={() => onIndex((index + 1) % images.length)}
      >
        ›
      </button>
      <p className="absolute bottom-4 flex items-center gap-2 text-xs text-white/80">
        <Expand className="size-3.5" />
        {index + 1} / {images.length}
      </p>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
