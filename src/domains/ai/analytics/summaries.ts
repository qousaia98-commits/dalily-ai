/**
 * Summaries facade — conversation / offer / review / admin.
 */

import {
  isAiAssistantEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { generateChatSummary, loadConversationLines } from "@/lib/ai/chat";
import { completeWithFallback } from "@/domains/ai/providers";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import type { AiSummaryView } from "@/domains/ai/shared/types";

export async function summarizeConversation(input: {
  conversationId: string;
  userId: string;
  locale?: string;
}): Promise<AiSummaryView | null> {
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) return null;

  try {
    const lines = await loadConversationLines(input.conversationId);
    const summary = await generateChatSummary({
      conversationId: input.conversationId,
      userId: input.userId,
      lines: lines ?? [],
      window: "last_10",
      style: "short",
      persist: true,
    });

    return {
      kind: "conversation",
      summary: [summary.title, summary.body, ...summary.bullets]
        .filter(Boolean)
        .join("\n"),
      locale: input.locale ?? "en",
      confidence: summary.generatedBy === "rules" ? 0.55 : 0.75,
      advisoryOnly: true,
    };
  } catch {
    return null;
  }
}

export async function summarizeArbitrary(input: {
  kind: AiSummaryView["kind"];
  text: string;
  userId: string;
  locale?: string;
}): Promise<AiSummaryView | null> {
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) return null;

  const result = await completeWithFallback({
    feature: "summary",
    actorUserId: input.userId,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content:
          'Summarize briefly for marketplace operators. JSON: {"summary":"...","confidence":0-1}. Do not invent facts.',
      },
      {
        role: "user",
        content: JSON.stringify({
          kind: input.kind,
          locale: input.locale ?? "en",
          text: scrubAiText(input.text).slice(0, 4000),
        }),
      },
    ],
  });

  if (!result.ok) return null;
  try {
    const parsed = JSON.parse(result.content) as {
      summary?: string;
      confidence?: number;
    };
    return {
      kind: input.kind,
      summary: parsed.summary ?? result.content.slice(0, 600),
      locale: input.locale ?? "en",
      confidence: parsed.confidence ?? 0.6,
      advisoryOnly: true,
    };
  } catch {
    return {
      kind: input.kind,
      summary: result.content.slice(0, 600),
      locale: input.locale ?? "en",
      confidence: 0.5,
      advisoryOnly: true,
    };
  }
}
