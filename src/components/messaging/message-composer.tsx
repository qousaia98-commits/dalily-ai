"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, MapPin, Paperclip, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { sendChatMessageAction } from "@/actions/chat.actions";
import { compressImageFile } from "@/lib/media/compress-image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string;
  onTyping?: () => void;
  disabled?: boolean;
};

export function MessageComposer({ conversationId, onTyping, disabled }: Props) {
  const t = useTranslations("messaging.composer");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text && !file) return;

    setError(null);
    startTransition(async () => {
      let uploadFile = file;
      if (uploadFile?.type.startsWith("image/")) {
        const compressed = await compressImageFile(uploadFile, {
          maxEdge: 1600,
          quality: 0.8,
        });
        uploadFile = compressed.file;
      }

      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("bodyText", text);
      fd.set("clientId", crypto.randomUUID());
      if (uploadFile) fd.set("file", uploadFile, uploadFile.name);

      const result = await sendChatMessageAction(fd);
      if (result.success) {
        setBody("");
        setFile(null);
        router.refresh();
      } else {
        setError(result.error ?? "send_failed");
      }
    });
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

  return (
    <form onSubmit={onSubmit} className="border-t border-border px-4 py-3" noValidate>
      {file ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="truncate">{file.name}</span>
          <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => setFile(null)}>
            {t("removeFile")}
          </Button>
        </div>
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
          disabled={pending || disabled || (!body.trim() && !file)}
          aria-label={t("send")}
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.doc,.docx"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          setFile(next);
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
