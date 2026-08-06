/**
 * Guest-accessible AI intake chat — clarifies a problem, then hands off
 * to `/request/new?q=…`. Never creates requests or contacts anyone.
 */

import { isIntakeChatEnabled } from "@/lib/config/feature-flags";
import { completeWithFallback } from "@/domains/ai/providers";
import { recommendModeration } from "@/domains/ai/moderation/service";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import {
  INTAKE_CHAT_MAX_MESSAGE_CHARS,
  INTAKE_CHAT_MAX_MESSAGES,
  type IntakeChatMessage,
} from "./intake-chat-shared";

export type {
  IntakeChatMessage,
  IntakeChatRole,
} from "./intake-chat-shared";
export {
  composeIntakeHandoffQuery,
  INTAKE_CHAT_MAX_MESSAGE_CHARS,
  INTAKE_CHAT_MAX_MESSAGES,
} from "./intake-chat-shared";

export type IntakeChatTurnResult = {
  reply: string;
  /** Best-effort problem summary for `/request/new?q=` handoff. */
  problemSummary: string | null;
  readyHint: boolean;
};

const SYSTEM_PROMPT = `You are Dalily's intake helper for customers in Syria.
Your only job: help them describe a home or local-service problem clearly so a matching business can help later.

Rules:
- Ask short, concrete clarifying questions (one or two at a time).
- Stay on local services (repairs, maintenance, home help, trades). Politely refuse unrelated topics.
- Never invent facts about specific businesses, prices, availability, or wait times.
- Never claim you created a request, contacted anyone, charged money, booked a visit, or took any action.
- You only help articulate the problem in chat. The customer continues in Dalily's normal request form afterward.
- Prefer the customer's language (Arabic or English). Keep replies concise.
- Respond ONLY as JSON: {"reply":"string","problemSummary":"string|null","readyHint":boolean}
  - reply: your next message to the customer
  - problemSummary: a clear 1–3 sentence description of the problem so far (null until you have a usable description)
  - readyHint: true when there is enough detail to continue to the request form`;

function normalizeMessages(
  raw: IntakeChatMessage[],
): IntakeChatMessage[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "empty_messages" };
  }
  if (raw.length > INTAKE_CHAT_MAX_MESSAGES) {
    return { error: "too_many_messages" };
  }

  const out: IntakeChatMessage[] = [];
  for (const item of raw) {
    if (!item || (item.role !== "user" && item.role !== "assistant")) {
      return { error: "invalid_message" };
    }
    const content = String(item.content ?? "").trim();
    if (!content || content.length > INTAKE_CHAT_MAX_MESSAGE_CHARS) {
      return { error: "invalid_message" };
    }
    out.push({ role: item.role, content: scrubAiText(content) });
  }

  const last = out[out.length - 1];
  if (!last || last.role !== "user") {
    return { error: "last_must_be_user" };
  }

  return out;
}

function parseModelJson(content: string): IntakeChatTurnResult {
  try {
    const parsed = JSON.parse(content) as {
      reply?: string;
      problemSummary?: string | null;
      readyHint?: boolean;
    };
    const reply = String(parsed.reply ?? "").trim();
    const summaryRaw =
      typeof parsed.problemSummary === "string"
        ? parsed.problemSummary.trim()
        : "";
    return {
      reply: reply || content.slice(0, 600),
      problemSummary: summaryRaw ? scrubAiText(summaryRaw).slice(0, 1200) : null,
      readyHint: Boolean(parsed.readyHint),
    };
  } catch {
    return {
      reply: content.slice(0, 600).trim() || "…",
      problemSummary: null,
      readyHint: false,
    };
  }
}

/**
 * One chat turn. Guests allowed (`actorUserId` may be null).
 * Applies moderation recommendations when the moderation flag is on;
 * blocks only clear high/critical hide/escalate cases before the main LLM call.
 */
export async function runIntakeChatTurn(input: {
  messages: IntakeChatMessage[];
  locale?: string;
  actorUserId?: string | null;
}): Promise<
  | { ok: true; turn: IntakeChatTurnResult }
  | { ok: false; error: string }
> {
  if (!isIntakeChatEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }

  const normalized = normalizeMessages(input.messages);
  if ("error" in normalized) {
    return { ok: false, error: normalized.error };
  }

  const latestUser = normalized[normalized.length - 1]!.content;
  const moderation = await recommendModeration({
    targetType: "description",
    text: latestUser,
    actorUserId: input.actorUserId ?? null,
    persist: false,
  });

  if (
    moderation &&
    (moderation.riskLevel === "critical" ||
      moderation.suggestedAction === "hide" ||
      moderation.suggestedAction === "escalate")
  ) {
    return { ok: false, error: "content_blocked" };
  }

  const locale = input.locale === "ar" ? "ar" : "en";
  const result = await completeWithFallback({
    feature: "assistant",
    actorUserId: input.actorUserId ?? null,
    temperature: 0.4,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\nLocale=${locale}.`,
      },
      ...normalized.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  if (!result.ok) {
    return { ok: false, error: "unavailable" };
  }

  return { ok: true, turn: parseModelJson(result.content) };
}
