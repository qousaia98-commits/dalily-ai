/**
 * Structured conversation summaries for customer / provider / admin.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { AssistantAudience, ConversationSummary } from "./types";

export type ChatLine = {
  senderRole?: "customer" | "provider" | "system" | string;
  bodyText: string;
  isSystem?: boolean;
  createdAt?: string;
};

function hashMessages(lines: ChatLine[]): string {
  const payload = lines
    .map((l) => `${l.senderRole ?? "?"}:${l.bodyText}`)
    .join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function extractBullets(lines: ChatLine[], max = 4): string[] {
  const bullets: string[] = [];
  for (const line of lines) {
    if (line.isSystem) continue;
    const text = scrubAiText(line.bodyText);
    if (text.length < 8) continue;
    const clipped = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    const who =
      line.senderRole === "provider"
        ? "Provider"
        : line.senderRole === "customer"
          ? "Customer"
          : "Party";
    bullets.push(`${who}: ${clipped}`);
    if (bullets.length >= max) break;
  }
  return bullets;
}

function detectOpenItems(lines: ChatLine[]): string[] {
  const open: string[] = [];
  const joined = lines.map((l) => l.bodyText.toLowerCase()).join(" ");
  if (/\?|هل|وين|متى|when|where|how much|كم/.test(joined)) {
    open.push("Unanswered questions may remain.");
  }
  if (/address|عنوان|location|موقع/.test(joined) === false) {
    open.push("Exact address may still be private.");
  }
  if (/time|موعد|ساعة|tomorrow|بكرة/.test(joined) === false) {
    open.push("Appointment time may need confirmation.");
  }
  return open.slice(0, 3);
}

function detectSentiment(
  lines: ChatLine[],
): ConversationSummary["sentiment"] {
  const text = lines.map((l) => l.bodyText).join(" ").toLowerCase();
  if (/angry|unacceptable|سيء|غاضب|refund|شكوى/.test(text)) return "tense";
  if (/thanks|شكرا|ممتاز|great|perfect/.test(text)) return "positive";
  return "neutral";
}

/**
 * Rule-based structured summary (fast, no LLM required).
 */
export function summarizeConversation(input: {
  audience: AssistantAudience;
  lines: ChatLine[];
}): ConversationSummary {
  const lines = input.lines.slice(-40);
  const bulletsEn = extractBullets(lines);
  const bulletsAr = bulletsEn.map((b) => b.replace("Customer:", "العميل:").replace("Provider:", "المزوّد:").replace("Party:", "طرف:"));
  const openEn = detectOpenItems(lines);
  const openAr = openEn.map((o) =>
    o
      .replace("Unanswered questions may remain.", "قد تبقى أسئلة بلا إجابة.")
      .replace("Exact address may still be private.", "قد يبقى العنوان الدقيق خاصاً.")
      .replace(
        "Appointment time may need confirmation.",
        "قد يحتاج موعد الزيارة إلى تأكيد.",
      ),
  );

  const headlineEn =
    input.audience === "admin"
      ? `Admin view: ${lines.length} messages reviewed.`
      : input.audience === "provider"
        ? "Customer conversation highlights"
        : "Your conversation with the business";

  const headlineAr =
    input.audience === "admin"
      ? `عرض الإدارة: ${lines.length} رسالة.`
      : input.audience === "provider"
        ? "أبرز نقاط المحادثة مع العميل"
        : "محادثتك مع النشاط";

  return {
    version: 7,
    audience: input.audience,
    headlineEn,
    headlineAr,
    bulletsEn:
      bulletsEn.length > 0
        ? bulletsEn
        : ["No substantial messages yet."],
    bulletsAr:
      bulletsAr.length > 0 ? bulletsAr : ["لا توجد رسائل جوهرية بعد."],
    openItemsEn: openEn,
    openItemsAr: openAr,
    sentiment: detectSentiment(lines),
    messageCount: lines.length,
  };
}

export async function summarizeAndStoreConversation(input: {
  conversationId: string;
  serviceRequestId?: string | null;
  audience: AssistantAudience;
  lines: ChatLine[];
}): Promise<ConversationSummary> {
  const summary = summarizeConversation({
    audience: input.audience,
    lines: input.lines,
  });
  const sourceHash = hashMessages(input.lines.slice(-40));

  try {
    const admin = createAdminClient();
    await admin.from("ai_conversation_summaries").upsert(
      {
        conversation_id: input.conversationId,
        service_request_id: input.serviceRequestId ?? null,
        audience: input.audience,
        summary: summary as unknown as Json,
        message_count: summary.messageCount,
        source_hash: sourceHash,
      } as never,
      { onConflict: "conversation_id,audience,source_hash" },
    );

    void emitAiLearningEvent({
      eventType: "assistant_summary_generated",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        conversationId: input.conversationId,
        audience: input.audience,
        messageCount: summary.messageCount,
      },
    });
  } catch {
    // best-effort
  }

  return summary;
}
