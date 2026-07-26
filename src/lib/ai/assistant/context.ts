/**
 * Job context memory — reuse confirmed facts, never re-ask answered questions.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type {
  AssistantAudience,
  AssistantContext,
  AssistantJobPhase,
  ConfirmedFacts,
  ConversationSummary,
} from "./types";

export async function loadAssistantContext(input: {
  serviceRequestId: string;
  audience: AssistantAudience;
}): Promise<AssistantContext | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_assistant_contexts")
      .select(
        "id, service_request_id, booking_id, conversation_id, audience, phase, confirmed_facts, asked_questions, last_summary",
      )
      .eq("service_request_id", input.serviceRequestId)
      .eq("audience", input.audience)
      .maybeSingle();
    if (!data) return null;
    return mapContext(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function upsertAssistantContext(input: {
  serviceRequestId: string;
  audience: AssistantAudience;
  phase?: AssistantJobPhase;
  bookingId?: string | null;
  conversationId?: string | null;
  confirmedFacts?: ConfirmedFacts;
  askedQuestions?: string[];
  lastSummary?: ConversationSummary | null;
  mergeFacts?: boolean;
}): Promise<AssistantContext | null> {
  try {
    const existing = await loadAssistantContext({
      serviceRequestId: input.serviceRequestId,
      audience: input.audience,
    });

    const facts = input.mergeFacts
      ? { ...(existing?.confirmedFacts ?? {}), ...(input.confirmedFacts ?? {}) }
      : (input.confirmedFacts ?? existing?.confirmedFacts ?? {});

    const asked = Array.from(
      new Set([
        ...(existing?.askedQuestions ?? []),
        ...(input.askedQuestions ?? []),
      ]),
    );

    const admin = createAdminClient();
    const row = {
      service_request_id: input.serviceRequestId,
      audience: input.audience,
      phase: input.phase ?? existing?.phase ?? "intake",
      booking_id: input.bookingId ?? existing?.bookingId ?? null,
      conversation_id:
        input.conversationId ?? existing?.conversationId ?? null,
      confirmed_facts: facts as unknown as Json,
      asked_questions: asked as unknown as Json,
      last_summary: (input.lastSummary ??
        existing?.lastSummary ??
        null) as unknown as Json,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("ai_assistant_contexts")
      .upsert(row as never, {
        onConflict: "service_request_id,audience",
      })
      .select(
        "id, service_request_id, booking_id, conversation_id, audience, phase, confirmed_facts, asked_questions, last_summary",
      )
      .single();

    if (error || !data) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[assistant.context]", error?.message);
      }
      return existing;
    }

    void emitAiLearningEvent({
      eventType: "assistant_context_updated",
      serviceRequestId: input.serviceRequestId,
      metadata: { audience: input.audience, phase: row.phase },
    });

    return mapContext(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function shouldAskQuestion(
  context: AssistantContext | null,
  questionKey: string,
): boolean {
  if (!context) return true;
  if (context.askedQuestions.includes(questionKey)) return false;
  const answered = context.confirmedFacts.questionsAnswered ?? [];
  return !answered.includes(questionKey);
}

function mapContext(data: Record<string, unknown>): AssistantContext {
  return {
    id: data.id as string,
    serviceRequestId: (data.service_request_id as string) ?? null,
    bookingId: (data.booking_id as string | null) ?? null,
    conversationId: (data.conversation_id as string | null) ?? null,
    audience: data.audience as AssistantAudience,
    phase: (data.phase as AssistantJobPhase) ?? "intake",
    confirmedFacts: (data.confirmed_facts as ConfirmedFacts) ?? {},
    askedQuestions: Array.isArray(data.asked_questions)
      ? (data.asked_questions as string[])
      : [],
    lastSummary: (data.last_summary as ConversationSummary | null) ?? null,
  };
}
