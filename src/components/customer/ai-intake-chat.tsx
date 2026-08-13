"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PatternBackdrop } from "@/components/brand/pattern-backdrop";
import {
  composeIntakeHandoffQuery,
  INTAKE_CHAT_MAX_MESSAGE_CHARS,
  INTAKE_CHAT_MAX_MESSAGES,
  type IntakeChatMessage,
} from "@/domains/customer/intake-chat-shared";
import { cn } from "@/lib/utils";

type UiMessage = IntakeChatMessage & { id: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AiIntakeChat() {
  const t = useTranslations("intakeChat");
  const tTrust = useTranslations("intentFlow.trust");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [readyHint, setReadyHint] = useState(false);
  const [problemSummary, setProblemSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("welcome"),
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userExchangeCount = messages.filter((m) => m.role === "user").length;
  const canContinue = userExchangeCount >= 1 && !pending;
  const atMessageCap = messages.length >= INTAKE_CHAT_MAX_MESSAGES;

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  function resolveError(code: string | undefined): string {
    switch (code) {
      case "rate_limited":
        return t("errors.rateLimited");
      case "content_blocked":
        return t("errors.contentBlocked");
      case "feature_disabled":
        return t("errors.unavailable");
      case "unavailable":
        return t("errors.unavailable");
      case "too_many_messages":
        return t("errors.tooMany");
      default:
        return t("errors.generic");
    }
  }

  function handoff() {
    const q = composeIntakeHandoffQuery(
      messages.map(({ role, content }) => ({ role, content })),
      problemSummary,
    );
    if (q.trim().length < 8) {
      setError(t("errors.needMore"));
      return;
    }
    router.push(`/request/new?q=${encodeURIComponent(q)}`);
  }

  function send() {
    const text = input.trim();
    if (!text || pending || atMessageCap) return;
    if (text.length > INTAKE_CHAT_MAX_MESSAGE_CHARS) {
      setError(t("errors.tooLong"));
      return;
    }

    setError(null);
    setInput("");
    const nextUser: UiMessage = { id: newId(), role: "user", content: text };
    const historyForApi: IntakeChatMessage[] = [
      ...messages
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];

    setMessages((prev) => [...prev, nextUser]);

    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/intake-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi, locale }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string;
          problemSummary?: string | null;
          readyHint?: boolean;
          error?: string;
        };

        if (!res.ok) {
          setError(resolveError(data.error));
          return;
        }

        const reply = String(data.reply ?? "").trim();
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { id: newId(), role: "assistant", content: reply },
          ]);
        }
        if (typeof data.problemSummary === "string" && data.problemSummary.trim()) {
          setProblemSummary(data.problemSummary.trim());
        }
        if (data.readyHint) setReadyHint(true);
      } catch {
        setError(t("errors.generic"));
      }
    });
  }

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6 sm:py-10">
      <PatternBackdrop patternOpacity={0.04} density="sparse" wash={false} />

      <header className="relative space-y-3 text-center sm:text-start">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)] px-3 py-1 text-xs font-semibold text-foreground">
          <Sparkles className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
          {t("eyebrow")}
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
        </div>
        <div className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-[var(--dalily-gold)]"
            aria-hidden
          />
          <p>{tTrust("privacy")}</p>
        </div>
      </header>

      <div
        ref={listRef}
        className="relative flex max-h-[min(28rem,55vh)] min-h-[16rem] flex-col gap-3 overflow-y-auto rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm sm:max-h-[min(32rem,50vh)]"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={cn(
                "flex w-full",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isUser
                    ? "bg-[var(--dalily-navy)] text-[var(--dalily-gold)] dark:bg-[color-mix(in_oklab,var(--dalily-navy-deep)_90%,var(--dalily-gold)_10%)]"
                    : "border border-border/60 bg-muted/40 text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            </div>
          );
        })}
        {pending ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("thinking")}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="relative text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {(canContinue || readyHint) && (
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground sm:text-sm">
            {readyHint ? t("readyHint") : t("continueHint")}
          </p>
          <Button
            type="button"
            className="min-h-11 rounded-xl"
            onClick={handoff}
            disabled={!canContinue}
          >
            {t("continueCta")}
            <ArrowRight className="ms-1.5 size-4 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      )}

      <form
        className="relative space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          rows={3}
          maxLength={INTAKE_CHAT_MAX_MESSAGE_CHARS}
          disabled={pending || atMessageCap}
          className="rounded-2xl resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t("inputHint")}</p>
          <Button
            type="submit"
            className="min-h-11 rounded-xl"
            disabled={pending || !input.trim() || atMessageCap}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            <span className="ms-1.5">{t("send")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
