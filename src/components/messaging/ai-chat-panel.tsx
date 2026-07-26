"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  X,
  Check,
  Languages,
  ListTodo,
  FileSearch,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  analyzeChatInsightsAction,
  completeChatActionItemAction,
  deleteChatSummariesAction,
  generateChatSummaryAction,
  getChatAiPreferencesAction,
  listChatActionItemsAction,
  suggestChatRepliesAction,
  trackChatAiPanelOpenedAction,
  updateChatAiPreferencesAction,
  acceptChatReplySuggestionAction,
} from "@/actions/chat-assistant.actions";
import { requestChatDraft } from "@/components/messaging/chat-thread-client-shell";
import { VoiceTranscriptSearch } from "@/components/messaging/voice-transcript-panel";
import type {
  ChatActionItem,
  ChatExtraction,
  ChatReplySuggestion,
  ChatSentimentResult,
  ChatSummaryResult,
  ChatSummaryStyle,
  ChatSummaryWindow,
} from "@/lib/ai/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string;
  enabled?: boolean;
  onUseSuggestion?: (text: string) => void;
};

const WINDOWS: ChatSummaryWindow[] = ["last_10", "today", "last_7_days", "entire"];
const STYLES: ChatSummaryStyle[] = ["short", "detailed", "timeline", "action"];

export function AiChatPanel({
  conversationId,
  enabled = true,
  onUseSuggestion,
}: Props) {
  const t = useTranslations("messaging.aiAssistant");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [windowKey, setWindowKey] = useState<ChatSummaryWindow>("last_10");
  const [styleKey, setStyleKey] = useState<ChatSummaryStyle>("short");
  const [summary, setSummary] = useState<ChatSummaryResult | null>(null);
  const [suggestions, setSuggestions] = useState<ChatReplySuggestion[]>([]);
  const [tasks, setTasks] = useState<ChatActionItem[]>([]);
  const [extractions, setExtractions] = useState<ChatExtraction[]>([]);
  const [sentiment, setSentiment] = useState<ChatSentimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applySuggestion(text: string) {
    onUseSuggestion?.(text);
    requestChatDraft(text);
  }

  useEffect(() => {
    void getChatAiPreferencesAction().then((p) => {
      if (p) setAiEnabled(p.aiEnabled);
    });
  }, []);

  if (!enabled) return null;

  function openPanel() {
    setOpen(true);
    void trackChatAiPanelOpenedAction(conversationId);
    startTransition(async () => {
      const items = await listChatActionItemsAction(conversationId);
      if (items.success) setTasks(items.items);
    });
  }

  function runSummary() {
    setError(null);
    startTransition(async () => {
      const result = await generateChatSummaryAction({
        conversationId,
        window: windowKey,
        style: styleKey,
      });
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      setSummary(result.summary);
    });
  }

  function runSuggestions() {
    setError(null);
    startTransition(async () => {
      const result = await suggestChatRepliesAction(conversationId);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      setSuggestions(result.suggestions);
    });
  }

  function runInsights() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeChatInsightsAction(conversationId);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      setExtractions(result.extractions ?? []);
      setTasks(result.tasks ?? []);
      setSentiment(result.sentiment ?? null);
    });
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-[var(--dalily-gold)]" />
          {t("title")}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{t("aiLabel")}</span>
          {sentiment && sentiment.sentiment !== "neutral" ? (
            <span
              className={cn(
                "size-1.5 rounded-full",
                sentiment.priority === "critical" || sentiment.priority === "high"
                  ? "bg-amber-500"
                  : "bg-emerald-500",
              )}
              title={t(`sentiment.${sentiment.sentiment}`)}
            />
          ) : null}
        </button>
        {open ? (
          <button type="button" onClick={() => setOpen(false)} aria-label="Close">
            <X className="size-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 px-4 pb-3 text-sm">
          <p className="text-[11px] text-muted-foreground">{t("privacyNote")}</p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={aiEnabled ? "outline" : "default"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const next = !aiEnabled;
                  await updateChatAiPreferencesAction({ aiEnabled: next });
                  setAiEnabled(next);
                })
              }
            >
              <ShieldOff className="me-1 size-3.5" />
              {aiEnabled ? t("disableAi") : t("enableAi")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending || !aiEnabled}
              onClick={() =>
                startTransition(async () => {
                  await deleteChatSummariesAction(conversationId);
                  setSummary(null);
                })
              }
            >
              {t("deleteSummaries")}
            </Button>
          </div>

          {!aiEnabled ? (
            <p className="text-xs text-muted-foreground">{t("disabledHint")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {WINDOWS.map((w) => (
                  <Chip key={w} active={windowKey === w} onClick={() => setWindowKey(w)}>
                    {t(`windows.${w}`)}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <Chip key={s} active={styleKey === s} onClick={() => setStyleKey(s)}>
                    {t(`styles.${s}`)}
                  </Chip>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={runSummary}>
                  {t("summarize")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={runSuggestions}
                >
                  {t("suggestReplies")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={runInsights}
                >
                  <FileSearch className="me-1 size-3.5" />
                  {t("extract")}
                </Button>
              </div>

              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {t("error")}
                </p>
              ) : null}

              {summary ? (
                <section className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("aiLabel")} · {summary.title}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">
                    {summary.body}
                  </p>
                  {summary.nextSteps.length ? (
                    <ul className="mt-2 list-disc ps-4 text-[11px] text-muted-foreground">
                      {summary.nextSteps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {suggestions.length ? (
                <section className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {t("repliesTitle")}
                  </p>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="block w-full rounded-xl border px-3 py-2 text-start text-xs hover:bg-muted/50"
                      onClick={() => {
                        applySuggestion(s.text);
                        void acceptChatReplySuggestionAction({
                          conversationId,
                          edited: false,
                        });
                      }}
                    >
                      {s.text}
                    </button>
                  ))}
                </section>
              ) : null}

              {extractions.length ? (
                <section className="space-y-1">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {t("extractionsTitle")}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {extractions.map((e, i) => (
                      <li key={e.id ?? `${e.fieldKey}-${i}`} className="rounded-lg bg-muted/40 px-2 py-1">
                        <span className="font-medium">{t(`fields.${e.fieldKey}`)}</span>:{" "}
                        {e.fieldValue}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {tasks.length ? (
                <section className="space-y-1.5">
                  <p className="inline-flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
                    <ListTodo className="size-3" />
                    {t("tasksTitle")}
                  </p>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs"
                    >
                      <span>{task.title}</span>
                      {task.status === "open" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-7"
                          disabled={pending || task.id.startsWith("tmp-")}
                          onClick={() =>
                            startTransition(async () => {
                              await completeChatActionItemAction({
                                conversationId,
                                itemId: task.id,
                              });
                              setTasks((prev) => prev.filter((x) => x.id !== task.id));
                            })
                          }
                        >
                          <Check className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </section>
              ) : null}

              {sentiment ? (
                <p className="text-[11px] text-muted-foreground">
                  <Languages className="me-1 inline size-3" />
                  {t(`sentiment.${sentiment.sentiment}`)} · {t(`priority.${sentiment.priority}`)}
                </p>
              ) : null}

              <VoiceTranscriptSearch conversationId={conversationId} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        active
          ? "bg-[var(--dalily-navy)] text-white"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
