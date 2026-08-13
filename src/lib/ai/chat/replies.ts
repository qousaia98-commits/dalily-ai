/**
 * Smart reply suggestions — never auto-sent; user must edit/confirm.
 */

import { scrubAiText } from "@/lib/ai/privacy/scrub";
import { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isAiChatAssistantEnabled } from "@/lib/config/feature-flags";
import type { ChatLine, ChatReplySuggestion } from "@/lib/ai/chat/types";

function rulesReplies(lines: ChatLine[], viewer: "customer" | "provider"): ChatReplySuggestion[] {
  const last = [...lines].reverse().find((l) => !l.isSystem && l.bodyText.trim());
  const text = (last?.bodyText ?? "").toLowerCase();
  const out: string[] = [];

  if (/when|متى|موعد|available|تقدر/.test(text)) {
    out.push(
      viewer === "provider"
        ? "I am available today at 15:30."
        : "Tomorrow morning works for me.",
      "I will check my schedule and confirm shortly.",
    );
  } else if (/price|كم|budget|سعر|كلفة/.test(text)) {
    out.push(
      viewer === "provider"
        ? "I can share a clear quote after a quick look at the details."
        : "Could you share an approximate budget range?",
    );
  } else if (/address|عنوان|location|وين/.test(text)) {
    out.push(
      viewer === "customer"
        ? "I can share the address after we confirm the booking."
        : "Please share the area or landmark so I can plan arrival.",
    );
  } else if (/photo|صورة|picture/.test(text)) {
    out.push("I will upload a clear photo shortly.");
  } else {
    out.push(
      viewer === "provider"
        ? "Thanks — I will follow up with the next step."
        : "Thanks — that works for me.",
      "Could you clarify that last point?",
    );
  }

  return out.slice(0, 3).map((t, i) => ({
    id: `rule-${i}`,
    text: t,
    rationale: "Contextual heuristic",
  }));
}

export async function suggestChatReplies(input: {
  conversationId: string;
  userId: string;
  viewer: "customer" | "provider";
  lines: ChatLine[];
}): Promise<ChatReplySuggestion[]> {
  const recent = input.lines.slice(-12);
  const transcript = recent
    .map((l) => `${l.senderRole}: ${scrubAiText(l.bodyText)}`)
    .join("\n");

  const raw = await chatAiComplete({
    temperature: 0.4,
    system: [
      "You suggest short reply options for a services marketplace chat (Dalily / Syria).",
      `Viewer role: ${input.viewer}.`,
      "Return ONLY JSON: {\"replies\":[{\"text\":\"...\",\"rationale\":\"...\"}]}.",
      "Max 3 replies, under 120 chars each, editable by the user.",
      "Never claim the message was sent. Never invent appointments as confirmed.",
      "Prefer English; Arabic OK if the conversation is Arabic-heavy.",
    ].join(" "),
    user: transcript || "Suggest polite generic follow-ups.",
  });

  const parsed = parseJsonObject<{
    replies?: Array<{ text?: string; rationale?: string }>;
  }>(raw);

  let suggestions: ChatReplySuggestion[] =
    parsed?.replies
      ?.map((r, i) => ({
        id: `llm-${i}`,
        text: scrubAiText(r.text || ""),
        rationale: r.rationale ? scrubAiText(r.rationale) : undefined,
      }))
      .filter((r) => r.text.length > 0)
      .slice(0, 3) ?? [];

  if (!suggestions.length) {
    suggestions = rulesReplies(recent, input.viewer);
  }

  if (isAiChatAssistantEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_ai_reply_suggested",
      customerId: input.userId,
      metadata: {
        conversationId: input.conversationId,
        count: suggestions.length,
        viewer: input.viewer,
      },
    });
  }

  return suggestions;
}
