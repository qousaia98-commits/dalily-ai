/**
 * Conversation summaries — windows + styles, LLM with rule fallback.
 * AI assists only; never sends messages.
 */

import { createClient } from "@/lib/supabase/server";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isAiChatAssistantEnabled } from "@/lib/config/feature-flags";
import type {
  ChatLine,
  ChatSummaryResult,
  ChatSummaryStyle,
  ChatSummaryWindow,
} from "@/lib/ai/chat/types";

function filterByWindow(lines: ChatLine[], window: ChatSummaryWindow): ChatLine[] {
  const now = Date.now();
  if (window === "last_10") return lines.slice(-10);
  if (window === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return lines.filter((l) => new Date(l.createdAt).getTime() >= start.getTime());
  }
  if (window === "last_7_days") {
    const cut = now - 7 * 864e5;
    return lines.filter((l) => new Date(l.createdAt).getTime() >= cut);
  }
  return lines.slice(-200);
}

function rulesSummary(
  lines: ChatLine[],
  window: ChatSummaryWindow,
  style: ChatSummaryStyle,
): ChatSummaryResult {
  const usable = lines.filter((l) => !l.isSystem && l.bodyText.trim().length > 0);
  const bullets = usable.slice(-6).map((l) => {
    const who =
      l.senderRole === "provider"
        ? "Provider"
        : l.senderRole === "customer"
          ? "Customer"
          : "Party";
    const text = scrubAiText(l.bodyText);
    return `${who}: ${text.length > 100 ? `${text.slice(0, 97)}…` : text}`;
  });

  const openItems: string[] = [];
  const joined = usable.map((l) => l.bodyText.toLowerCase()).join(" ");
  if (/\?|متى|when|كم|how much/.test(joined)) openItems.push("Open questions remain");
  if (/invoice|فاتورة|photo|صورة|confirm|أكد/.test(joined)) {
    openItems.push("Follow-up actions may be pending");
  }

  const nextSteps =
    style === "action"
      ? ["Confirm next availability", "Clarify remaining details", "Share needed documents"]
      : ["Continue the conversation", "Confirm agreements in writing"];

  let body = bullets.join(" · ") || "No recent messages to summarize.";
  let title = "Conversation summary";

  if (style === "short") {
    title = "Short summary";
    body = bullets.slice(-2).join(" · ") || body;
  } else if (style === "detailed") {
    title = "Detailed summary";
    body = bullets.join("\n");
  } else if (style === "timeline") {
    title = "Timeline";
    body = usable
      .slice(-8)
      .map((l) => {
        const t = new Date(l.createdAt).toLocaleString();
        return `${t} — ${l.senderRole}: ${scrubAiText(l.bodyText).slice(0, 80)}`;
      })
      .join("\n");
  } else if (style === "action") {
    title = "Action-oriented summary";
    body = `Focus: resolve open items.\n${bullets.slice(-3).join("\n")}`;
  }

  return {
    window,
    style,
    title,
    body,
    bullets,
    openItems,
    nextSteps,
    generatedBy: "rules",
    aiGenerated: true,
  };
}

async function llmSummary(
  lines: ChatLine[],
  window: ChatSummaryWindow,
  style: ChatSummaryStyle,
): Promise<ChatSummaryResult | null> {
  const transcript = lines
    .slice(-40)
    .map((l) => `${l.senderRole}: ${scrubAiText(l.bodyText)}`)
    .join("\n");

  const raw = await chatAiComplete({
    temperature: 0.2,
    system: [
      "You summarize marketplace service conversations for Dalily.",
      "Return ONLY JSON: {\"title\",\"body\",\"bullets\":[],\"openItems\":[],\"nextSteps\":[]}.",
      `Style: ${style}. Window: ${window}.`,
      "Scrub phones/emails. Do not invent facts. Label is for human review — AI never sends messages.",
      "Languages: English preferred for structured fields; body may mix AR/EN briefly.",
    ].join(" "),
    user: transcript || "(empty)",
  });

  const parsed = parseJsonObject<{
    title?: string;
    body?: string;
    bullets?: string[];
    openItems?: string[];
    nextSteps?: string[];
  }>(raw);
  if (!parsed?.body && !parsed?.title) return null;

  return {
    window,
    style,
    title: scrubAiText(parsed.title || "Conversation summary"),
    body: scrubAiText(parsed.body || ""),
    bullets: (parsed.bullets ?? []).map(scrubAiText).slice(0, 8),
    openItems: (parsed.openItems ?? []).map(scrubAiText).slice(0, 5),
    nextSteps: (parsed.nextSteps ?? []).map(scrubAiText).slice(0, 5),
    generatedBy: "llm",
    aiGenerated: true,
  };
}

export async function generateChatSummary(input: {
  conversationId: string;
  userId: string;
  lines: ChatLine[];
  window: ChatSummaryWindow;
  style: ChatSummaryStyle;
  persist?: boolean;
}): Promise<ChatSummaryResult> {
  const scoped = filterByWindow(input.lines, input.window);
  const fallback = rulesSummary(scoped, input.window, input.style);
  const llm = await llmSummary(scoped, input.window, input.style);
  const result: ChatSummaryResult = llm
    ? { ...llm, generatedBy: "hybrid", aiGenerated: true }
    : fallback;

  if (input.persist !== false) {
    try {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("ai_conversation_summaries").insert({
        conversation_id: input.conversationId,
        audience: "customer",
        summary: result,
        message_count: scoped.length,
        window_key: input.window,
        style_key: input.style,
        generated_by: result.generatedBy,
      });
    } catch {
      /* fail-soft */
    }
  }

  if (isAiChatAssistantEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_ai_summary_generated",
      customerId: input.userId,
      metadata: {
        conversationId: input.conversationId,
        window: input.window,
        style: input.style,
        by: result.generatedBy,
      },
    });
  }

  return result;
}

export async function deleteChatSummaries(input: {
  conversationId: string;
  userId: string;
}): Promise<number> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("ai_conversation_summaries")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: input.userId,
      })
      .eq("conversation_id", input.conversationId)
      .is("deleted_at", null)
      .select("id");
    if (error) return 0;
    if (isAiChatAssistantEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_ai_summary_deleted",
        customerId: input.userId,
        metadata: {
          conversationId: input.conversationId,
          count: (data ?? []).length,
        },
      });
    }
    return (data ?? []).length;
  } catch {
    return 0;
  }
}
