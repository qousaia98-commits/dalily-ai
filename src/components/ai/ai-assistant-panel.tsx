"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AiAssistantCapability, AiAssistantResponseView } from "@/domains/ai/shared/types";

const CUSTOMER_OPTIONS: AiAssistantCapability[] = [
  "improve_description",
  "structure_request",
  "recommend_category",
  "estimate_budget",
  "compare_offers",
  "platform_faq",
  "dispute_help",
];

const PROVIDER_OPTIONS: AiAssistantCapability[] = [
  "draft_offer",
  "improve_proposal",
  "improve_profile",
  "suggest_pricing",
  "suggest_times",
  "trust_tips",
  "draft_reply",
];

/**
 * Enterprise assistant panel — recommendations only; regenerate / copy / feedback.
 */
export function AiAssistantPanel({
  role = "customer",
}: {
  role?: "customer" | "provider";
}) {
  const t = useTranslations("aiPlatform.assistant");
  const [pending, startTransition] = useTransition();
  const [capability, setCapability] = useState<AiAssistantCapability>(
    role === "provider" ? "draft_offer" : "improve_description",
  );
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AiAssistantResponseView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const options = role === "provider" ? PROVIDER_OPTIONS : CUSTOMER_OPTIONS;

  function run(regenerate = false) {
    startTransition(async () => {
      setError(null);
      if (!regenerate) setFeedback(null);
      try {
        const res = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            capability,
            prompt: prompt.trim() || (regenerate ? result?.body : ""),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "failed");
        setResult(json.assistant);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  }

  async function copyBody() {
    if (!result?.body) return;
    try {
      await navigator.clipboard.writeText(result.body);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("controlNote")}</p>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t("capability")}</span>
        <select
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
          value={capability}
          onChange={(e) =>
            setCapability(e.target.value as AiAssistantCapability)
          }
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t("prompt")}</span>
        <textarea
          className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("promptPlaceholder")}
          maxLength={4000}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !prompt.trim()}
          onClick={() => run(false)}
          className="rounded-lg bg-[var(--dalily-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? t("loading") : t("generate")}
        </button>
        {result ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(true)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {t("regenerate")}
            </button>
            <button
              type="button"
              onClick={() => void copyBody()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              {t("copy")}
            </button>
          </>
        ) : null}
      </div>

      {pending && !result ? (
        <div className="space-y-2 animate-pulse" aria-busy="true">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-16 rounded bg-muted" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-lg border border-border/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{result.title}</h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("confidence", {
                value: Math.round(result.confidence * 100),
              })}
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {result.body}
          </p>
          {result.bullets.length > 0 ? (
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {result.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${
                feedback === "up" ? "border-[var(--dalily-gold)]" : "border-border"
              }`}
              onClick={() => setFeedback("up")}
            >
              {t("feedbackUp")}
            </button>
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${
                feedback === "down"
                  ? "border-destructive"
                  : "border-border"
              }`}
              onClick={() => setFeedback("down")}
            >
              {t("feedbackDown")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
