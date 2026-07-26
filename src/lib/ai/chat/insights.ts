/**
 * Structured information extraction + action item detection + sentiment.
 */

import { createClient } from "@/lib/supabase/server";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isAiChatAssistantEnabled } from "@/lib/config/feature-flags";
import type {
  ChatActionItem,
  ChatActionKind,
  ChatExtraction,
  ChatExtractionField,
  ChatLine,
  ChatSentimentResult,
} from "@/lib/ai/chat/types";

function rulesExtract(lines: ChatLine[]): ChatExtraction[] {
  const out: ChatExtraction[] = [];
  const text = lines.map((l) => l.bodyText).join("\n");

  const phone = text.match(/(?:\+?\d[\d\s-]{7,}\d)/);
  if (phone) {
    out.push({
      fieldKey: "phone",
      fieldValue: "[phone]",
      confidence: 0.7,
    });
  }

  const budget = text.match(/(?:SYP|USD|\$|ل\.?س)\s*[\d,]+|[\d,]+\s*(?:SYP|USD|ل\.?س)/i);
  if (budget) {
    out.push({
      fieldKey: "budget",
      fieldValue: scrubAiText(budget[0]),
      confidence: 0.65,
    });
  }

  if (/urgent|طوارئ|asap|فوري|emergency/i.test(text)) {
    out.push({ fieldKey: "urgency", fieldValue: "high", confidence: 0.7 });
  }

  if (/tomorrow|بكرة|غدا|today at|اليوم الساعة|موعد/i.test(text)) {
    out.push({
      fieldKey: "appointment",
      fieldValue: scrubAiText(
        text.match(/(tomorrow[^.!?\n]*|today at[^.!?\n]*|بكرة[^.!?\n]*|موعد[^.!?\n]*)/i)?.[0] ??
          "Appointment mentioned",
      ),
      confidence: 0.55,
    });
  }

  if (/address|عنوان|حي |شارع /i.test(text)) {
    out.push({
      fieldKey: "address",
      fieldValue: "Address discussed (details may be private)",
      confidence: 0.5,
    });
  }

  return out.slice(0, 8);
}

function rulesTasks(lines: ChatLine[]): Omit<ChatActionItem, "id">[] {
  const text = lines.map((l) => l.bodyText.toLowerCase()).join(" ");
  const tasks: Omit<ChatActionItem, "id">[] = [];

  const push = (kind: ChatActionKind, title: string, titleAr: string) => {
    tasks.push({
      title,
      titleAr,
      kind,
      status: "open",
      priority: kind === "confirm_appointment" ? "high" : "normal",
      assigneeRole: "either",
    });
  };

  if (/invoice|فاتورة|bill/.test(text)) push("send_invoice", "Send invoice", "إرسال الفاتورة");
  if (/photo|صورة|picture|upload/.test(text)) push("upload_photo", "Upload photo", "رفع صورة");
  if (/confirm|أكد|تأكيد|appointment|موعد/.test(text)) {
    push("confirm_appointment", "Confirm appointment", "تأكيد الموعد");
  }
  if (/call|اتصل|تواصل/.test(text)) push("call_customer", "Call customer", "الاتصال بالعميل");
  if (/material|مواد|order|اطلب/.test(text)) {
    push("order_materials", "Order materials", "طلب المواد");
  }

  return tasks.slice(0, 5);
}

export function scoreChatSentiment(lines: ChatLine[]): ChatSentimentResult {
  const text = lines.map((l) => l.bodyText.toLowerCase()).join(" ");
  const signals: string[] = [];

  if (/angry|unacceptable|سيء|غاضب|refund|شكوى|terrible|اسوأ/.test(text)) {
    signals.push("frustration_keywords");
  }
  if (/urgent|طوارئ|asap|فوري|emergency|now!/.test(text)) {
    signals.push("urgency_keywords");
  }
  if (/thanks|شكرا|ممتاز|great|perfect|رائع/.test(text)) {
    signals.push("positive_keywords");
  }
  if (/lawyer|police|escalate|مدير|شكوى رسمية/.test(text)) {
    signals.push("escalation_keywords");
  }

  let sentiment: ChatSentimentResult["sentiment"] = "neutral";
  let priority: ChatSentimentResult["priority"] = "normal";
  let score = 0.5;

  if (signals.includes("escalation_keywords")) {
    sentiment = "escalation_risk";
    priority = "critical";
    score = 0.9;
  } else if (signals.includes("frustration_keywords")) {
    sentiment = "frustrated";
    priority = "high";
    score = 0.75;
  } else if (signals.includes("urgency_keywords")) {
    sentiment = "urgent";
    priority = "high";
    score = 0.7;
  } else if (signals.includes("positive_keywords")) {
    sentiment = "positive";
    priority = "low";
    score = 0.35;
  }

  return { sentiment, priority, score, signals };
}

export async function extractChatInsights(input: {
  conversationId: string;
  userId: string;
  lines: ChatLine[];
  persist?: boolean;
}): Promise<{
  extractions: ChatExtraction[];
  tasks: ChatActionItem[];
  sentiment: ChatSentimentResult;
}> {
  const recent = input.lines.slice(-30);
  const transcript = recent
    .map((l) => `${l.senderRole}: ${scrubAiText(l.bodyText)}`)
    .join("\n");

  let extractions = rulesExtract(recent);
  let taskDrafts = rulesTasks(recent);
  const sentiment = scoreChatSentiment(recent);

  const raw = await chatAiComplete({
    temperature: 0.1,
    system: [
      "Extract structured facts and tasks from a marketplace chat.",
      'Return ONLY JSON: {"extractions":[{"fieldKey","fieldValue","confidence"}],"tasks":[{"title","titleAr","kind","priority"}]}.',
      "fieldKey in: appointment,address,phone,budget,requested_date,service_type,materials,urgency,other",
      "kind in: send_invoice,upload_photo,confirm_appointment,call_customer,order_materials,other",
      "Scrub phones to [phone]. Do not invent.",
    ].join(" "),
    user: transcript || "(empty)",
  });

  const parsed = parseJsonObject<{
    extractions?: Array<{
      fieldKey?: string;
      fieldValue?: string;
      confidence?: number;
    }>;
    tasks?: Array<{
      title?: string;
      titleAr?: string;
      kind?: string;
      priority?: string;
    }>;
  }>(raw);

  if (parsed?.extractions?.length) {
    extractions = parsed.extractions
      .map((e) => ({
        fieldKey: (e.fieldKey as ChatExtractionField) || "other",
        fieldValue: scrubAiText(e.fieldValue || ""),
        confidence: Math.min(1, Math.max(0, Number(e.confidence ?? 0.5))),
      }))
      .filter((e) => e.fieldValue)
      .slice(0, 10);
  }

  if (parsed?.tasks?.length) {
    taskDrafts = parsed.tasks
      .map((t) => ({
        title: scrubAiText(t.title || "Task"),
        titleAr: t.titleAr ? scrubAiText(t.titleAr) : null,
        kind: (t.kind as ChatActionKind) || "other",
        status: "open" as const,
        priority: (t.priority as ChatActionItem["priority"]) || "normal",
        assigneeRole: "either" as const,
      }))
      .slice(0, 5);
  }

  const tasks: ChatActionItem[] = [];

  if (input.persist !== false) {
    try {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      for (const e of extractions) {
        const { data } = await db
          .from("ai_chat_extractions")
          .insert({
            conversation_id: input.conversationId,
            field_key: e.fieldKey,
            field_value: e.fieldValue,
            confidence: e.confidence,
            source: "ai",
            created_by: input.userId,
          })
          .select("id")
          .single();
        if (data?.id) e.id = String(data.id);
      }

      for (const t of taskDrafts) {
        const { data } = await db
          .from("ai_chat_action_items")
          .insert({
            conversation_id: input.conversationId,
            title: t.title,
            title_ar: t.titleAr,
            kind: t.kind,
            status: "open",
            priority: t.priority,
            assignee_role: t.assigneeRole,
            confidence: 0.6,
          })
          .select("id")
          .single();
        if (data?.id) {
          tasks.push({ ...t, id: String(data.id) });
        }
      }

      await db.from("ai_chat_sentiment").insert({
        conversation_id: input.conversationId,
        sentiment: sentiment.sentiment,
        priority: sentiment.priority,
        score: sentiment.score,
        signals: sentiment.signals,
      });
    } catch {
      /* fail-soft — return in-memory */
      taskDrafts.forEach((t, i) => tasks.push({ ...t, id: `tmp-${i}` }));
    }
  } else {
    taskDrafts.forEach((t, i) => tasks.push({ ...t, id: `tmp-${i}` }));
  }

  if (!tasks.length) {
    taskDrafts.forEach((t, i) => tasks.push({ ...t, id: `tmp-${i}` }));
  }

  if (isAiChatAssistantEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_ai_extraction_created",
      customerId: input.userId,
      metadata: {
        conversationId: input.conversationId,
        count: extractions.length,
      },
    });
    void emitAiLearningEvent({
      eventType: "chat_ai_task_detected",
      customerId: input.userId,
      metadata: {
        conversationId: input.conversationId,
        count: tasks.length,
      },
    });
    void emitAiLearningEvent({
      eventType: "chat_ai_sentiment_scored",
      customerId: input.userId,
      metadata: {
        conversationId: input.conversationId,
        sentiment: sentiment.sentiment,
        priority: sentiment.priority,
      },
    });
  }

  return { extractions, tasks, sentiment };
}

export async function listOpenActionItems(
  conversationId: string,
): Promise<ChatActionItem[]> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("ai_chat_action_items")
      .select("id, title, title_ar, kind, status, priority, assignee_role")
      .eq("conversation_id", conversationId)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      titleAr: (r.title_ar as string | null) ?? null,
      kind: r.kind as ChatActionKind,
      status: "open",
      priority: (r.priority as ChatActionItem["priority"]) || "normal",
      assigneeRole: (r.assignee_role as ChatActionItem["assigneeRole"]) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function completeActionItem(input: {
  itemId: string;
  userId: string;
  conversationId: string;
}): Promise<boolean> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("ai_chat_action_items")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: input.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.itemId)
      .eq("conversation_id", input.conversationId);
    if (error) return false;
    if (isAiChatAssistantEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_ai_task_completed",
        customerId: input.userId,
        metadata: {
          conversationId: input.conversationId,
          itemId: input.itemId,
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function correctExtraction(input: {
  extractionId: string;
  userId: string;
  fieldValue: string;
  conversationId: string;
}): Promise<boolean> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("ai_chat_extractions")
      .update({
        field_value: scrubAiText(input.fieldValue),
        source: "corrected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.extractionId)
      .eq("conversation_id", input.conversationId);
    if (error) return false;
    if (isAiChatAssistantEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_ai_extraction_corrected",
        customerId: input.userId,
        metadata: {
          conversationId: input.conversationId,
          extractionId: input.extractionId,
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}
