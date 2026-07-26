"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Languages, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteChatVoiceTranscriptAction,
  getChatVoiceTranscriptAction,
  searchChatVoiceTranscriptsAction,
  setChatVoiceConsentAction,
  translateChatVoiceTranscriptAction,
  trackChatVoicePlayedAction,
} from "@/actions/chat-voice.actions";
import { getChatAiPreferencesAction } from "@/actions/chat-assistant.actions";
import type { ChatAiLanguage } from "@/lib/ai/chat/types";
import type { ChatVoiceTranscript } from "@/lib/ai/chat/voice-types";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string;
  messageId: string;
  enabled?: boolean;
};

export function VoiceTranscriptPanel({
  conversationId,
  messageId,
  enabled = true,
}: Props) {
  const t = useTranslations("messaging.voice");
  const [pending, startTransition] = useTransition();
  const [transcript, setTranscript] = useState<ChatVoiceTranscript | null>(null);
  const [consent, setConsent] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    void getChatAiPreferencesAction().then((p) => {
      if (p) setConsent(Boolean(p.allowVoiceTranscription));
    });
    startTransition(async () => {
      const result = await getChatVoiceTranscriptAction(messageId);
      if (result.success) setTranscript(result.transcript);
    });
  }, [enabled, messageId]);

  if (!enabled) return null;

  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-white/15 bg-black/10 p-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] uppercase">
          {t("aiLabel")}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-7 px-2 text-[10px]"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const next = !consent;
              await setChatVoiceConsentAction(next);
              setConsent(next);
            })
          }
        >
          {consent ? t("revokeConsent") : t("grantConsent")}
        </Button>
      </div>

      {!consent ? (
        <p className="text-muted-foreground opacity-90">{t("consentHint")}</p>
      ) : null}

      {transcript?.transcriptText ? (
        <>
          <p className="whitespace-pre-wrap text-foreground/95">
            {showTranslated && translated
              ? translated
              : transcript.transcriptText}
          </p>
          {transcript.summaryText ? (
            <p className="text-muted-foreground">
              <strong>{t("summary")}:</strong> {transcript.summaryText}
            </p>
          ) : null}
          {transcript.summaryBullets?.length ? (
            <ul className="list-disc ps-4 text-muted-foreground">
              {transcript.summaryBullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {(["en", "ar", "de"] as ChatAiLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className="rounded px-1.5 py-0.5 uppercase opacity-70 hover:bg-black/10"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await translateChatVoiceTranscriptAction({
                      transcriptId: transcript.id,
                      conversationId,
                      targetLang: lang,
                      sourceText: transcript.transcriptText,
                    });
                    if (result.success && result.text) {
                      setTranslated(result.text);
                      setShowTranslated(true);
                    }
                  })
                }
              >
                <Languages className="me-0.5 inline size-3" />
                {lang}
              </button>
            ))}
            {translated ? (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 opacity-70 hover:bg-black/10"
                onClick={() => setShowTranslated((v) => !v)}
              >
                {showTranslated ? t("viewOriginal") : t("viewTranslated")}
              </button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-7 px-2 text-[10px]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteChatVoiceTranscriptAction({
                    transcriptId: transcript.id,
                    conversationId,
                  });
                  setTranscript(null);
                  setTranslated(null);
                })
              }
            >
              <Trash2 className="me-1 size-3" />
              {t("deleteTranscript")}
            </Button>
          </div>
        </>
      ) : consent ? (
        <p className="text-muted-foreground">{t("noTranscript")}</p>
      ) : null}
    </div>
  );
}

export function VoiceTranscriptSearch({
  conversationId,
}: {
  conversationId: string;
}) {
  const t = useTranslations("messaging.voice");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<
    Array<{ id: string; messageId: string; transcriptText: string }>
  >([]);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2 rounded-2xl border bg-muted/30 p-3">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">
        {t("searchTitle")}
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border bg-background px-3 py-1.5 text-xs"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              startTransition(async () => {
                const result = await searchChatVoiceTranscriptsAction({
                  query: q,
                  conversationId,
                });
                if (result.success) setHits(result.hits);
              });
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || q.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              const result = await searchChatVoiceTranscriptsAction({
                query: q,
                conversationId,
              });
              if (result.success) setHits(result.hits);
            })
          }
        >
          <Search className="size-3.5" />
        </Button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
        {hits.map((h) => (
          <li key={h.id} className={cn("rounded-lg bg-card px-2 py-1.5")}>
            {h.transcriptText.slice(0, 160)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Fire-and-forget play tracking for learning. */
export function trackVoicePlay(conversationId: string, messageId?: string) {
  void trackChatVoicePlayedAction({ conversationId, messageId });
}
