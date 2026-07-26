"use server";

/**
 * AI Engine Phase 7 — Assistant actions.
 */

import { getAuthUser } from "@/lib/auth/session";
import { isAiEngineV7Enabled } from "@/lib/config/feature-flags";
import { resolveSuggestionFeedback } from "@/lib/ai/assistant/suggestions";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  summarizeAndStoreConversation,
  type ChatLine,
} from "@/lib/ai/assistant/summarize";
import type { AssistantAudience } from "@/lib/ai/assistant/types";

export async function assistantSuggestionFeedbackAction(input: {
  suggestionId: string;
  status: "accepted" | "ignored" | "rejected";
  serviceRequestId?: string;
}): Promise<{ success: boolean }> {
  if (!isAiEngineV7Enabled()) return { success: false };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };

  const ok = await resolveSuggestionFeedback({
    suggestionId: input.suggestionId,
    status: input.status,
    serviceRequestId: input.serviceRequestId,
  });
  return { success: ok };
}

export async function rateConversationSummaryAction(input: {
  summaryId: string;
  rating: number;
  serviceRequestId?: string;
}): Promise<{ success: boolean }> {
  if (!isAiEngineV7Enabled()) return { success: false };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  if (input.rating < 1 || input.rating > 5) return { success: false };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("ai_conversation_summaries")
      .update({ usefulness_rating: input.rating } as never)
      .eq("id", input.summaryId);
    if (error) return { success: false };

    void emitAiLearningEvent({
      eventType: "assistant_summary_rated",
      serviceRequestId: input.serviceRequestId,
      customerId: authUser.id,
      metadata: { summaryId: input.summaryId, rating: input.rating },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function generateConversationSummaryAction(input: {
  conversationId: string;
  serviceRequestId?: string;
  audience: AssistantAudience;
}): Promise<{ success: boolean; summary?: Awaited<ReturnType<typeof summarizeAndStoreConversation>> }> {
  if (!isAiEngineV7Enabled()) return { success: false };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };

  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("messages")
      .select("body_text, is_system, created_at, sender_id")
      .eq("conversation_id", input.conversationId)
      .order("created_at", { ascending: true })
      .limit(80);

    const lines: ChatLine[] = (rows ?? []).map((r) => ({
      bodyText: String(r.body_text ?? ""),
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at as string,
      senderRole: "customer",
    }));

    const summary = await summarizeAndStoreConversation({
      conversationId: input.conversationId,
      serviceRequestId: input.serviceRequestId,
      audience: input.audience,
      lines,
    });
    return { success: true, summary };
  } catch {
    return { success: false };
  }
}
