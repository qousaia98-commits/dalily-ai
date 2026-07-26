"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isAiChatAssistantEnabled } from "@/lib/config/feature-flags";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  assertAiAllowed,
  completeActionItem,
  correctExtraction,
  deleteChatSummaries,
  extractChatInsights,
  generateChatSummary,
  getChatAiPreferences,
  listOpenActionItems,
  loadConversationLines,
  suggestChatReplies,
  translateChatMessage,
  upsertChatAiPreferences,
} from "@/lib/ai/chat";
import type {
  ChatAiLanguage,
  ChatSummaryStyle,
  ChatSummaryWindow,
} from "@/lib/ai/chat/types";

async function assertParticipant(conversationId: string, userId: string) {
  const { assertChatParticipants } = await import("@/domains/chat/authz");
  const { isChatAuthV2Enabled } = await import("@/lib/config/feature-flags");
  if (isChatAuthV2Enabled()) {
    const gate = await assertChatParticipants({ conversationId, userId });
    if (!gate.ok) return { ok: false as const, error: gate.error };
    return {
      ok: true as const,
      customerId: gate.customerId,
      providerOwnerId: gate.providerOwnerId,
    };
  }
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false as const, error: "not_found" as const };
  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();
  if (userId !== conv.customer_id && userId !== providerRow?.owner_id) {
    return { ok: false as const, error: "forbidden" as const };
  }
  return {
    ok: true as const,
    customerId: conv.customer_id as string,
    providerOwnerId: (providerRow?.owner_id as string) ?? null,
  };
}

function viewerRole(
  userId: string,
  customerId: string,
  providerOwnerId: string | null,
): "customer" | "provider" {
  return userId === providerOwnerId ? "provider" : "customer";
}

export async function getChatAiPreferencesAction() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  return getChatAiPreferences(authUser.id);
}

export async function updateChatAiPreferencesAction(patch: {
  aiEnabled?: boolean;
  preferredLanguage?: ChatAiLanguage | "auto" | null;
  autoTranslate?: boolean;
  allowSummaries?: boolean;
  allowSuggestions?: boolean;
  allowExtraction?: boolean;
  allowVoiceTranscription?: boolean;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  if (!isAiChatAssistantEnabled()) return { success: false, error: "feature_disabled" };
  const next = await upsertChatAiPreferences(authUser.id, patch);
  void emitAiLearningEvent({
    eventType: next.aiEnabled ? "chat_ai_enabled" : "chat_ai_disabled",
    customerId: authUser.id,
    metadata: { aiEnabled: next.aiEnabled },
  });
  return { success: true, preferences: next };
}

export async function generateChatSummaryAction(input: {
  conversationId: string;
  window?: ChatSummaryWindow;
  style?: ChatSummaryStyle;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, error: "login_required" };
  if (!isAiChatAssistantEnabled()) {
    return { success: false as const, error: "feature_disabled" };
  }
  const prefs = await getChatAiPreferences(authUser.id);
  if (!assertAiAllowed(prefs, "summaries")) {
    return { success: false as const, error: "ai_disabled" };
  }
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, error: gate.error };

  const lines = await loadConversationLines(input.conversationId);
  const summary = await generateChatSummary({
    conversationId: input.conversationId,
    userId: authUser.id,
    lines,
    window: input.window ?? "last_10",
    style: input.style ?? "short",
  });
  return { success: true as const, summary };
}

export async function deleteChatSummariesAction(conversationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, deleted: 0 };
  const gate = await assertParticipant(conversationId, authUser.id);
  if (!gate.ok) return { success: false, deleted: 0 };
  const deleted = await deleteChatSummaries({
    conversationId,
    userId: authUser.id,
  });
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);
  return { success: true, deleted };
}

export async function suggestChatRepliesAction(conversationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, suggestions: [] };
  if (!isAiChatAssistantEnabled()) {
    return { success: false as const, suggestions: [], error: "feature_disabled" };
  }
  const prefs = await getChatAiPreferences(authUser.id);
  if (!assertAiAllowed(prefs, "suggestions")) {
    return { success: false as const, suggestions: [], error: "ai_disabled" };
  }
  const gate = await assertParticipant(conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, suggestions: [] };

  const viewer = viewerRole(authUser.id, gate.customerId, gate.providerOwnerId);
  const lines = await loadConversationLines(conversationId);
  const suggestions = await suggestChatReplies({
    conversationId,
    userId: authUser.id,
    viewer,
    lines,
  });
  return { success: true as const, suggestions };
}

export async function acceptChatReplySuggestionAction(input: {
  conversationId: string;
  edited: boolean;
}) {
  const authUser = await getAuthUser();
  if (!authUser || !isAiChatAssistantEnabled()) return { success: false };
  void emitAiLearningEvent({
    eventType: input.edited ? "chat_ai_reply_edited" : "chat_ai_reply_accepted",
    customerId: authUser.id,
    metadata: { conversationId: input.conversationId },
  });
  return { success: true };
}

export async function translateChatMessageAction(input: {
  conversationId: string;
  messageId: string;
  text: string;
  targetLang: ChatAiLanguage;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, result: null };
  if (!isAiChatAssistantEnabled()) {
    return { success: false as const, result: null, error: "feature_disabled" };
  }
  const prefs = await getChatAiPreferences(authUser.id);
  if (!assertAiAllowed(prefs, "any")) {
    return { success: false as const, result: null, error: "ai_disabled" };
  }
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, result: null };

  const result = await translateChatMessage({
    ...input,
    userId: authUser.id,
  });
  return { success: Boolean(result), result };
}

export async function analyzeChatInsightsAction(conversationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const };
  if (!isAiChatAssistantEnabled()) {
    return { success: false as const, error: "feature_disabled" };
  }
  const prefs = await getChatAiPreferences(authUser.id);
  if (!assertAiAllowed(prefs, "extraction")) {
    return { success: false as const, error: "ai_disabled" };
  }
  const gate = await assertParticipant(conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, error: gate.error };

  const lines = await loadConversationLines(conversationId);
  const insights = await extractChatInsights({
    conversationId,
    userId: authUser.id,
    lines,
  });
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);
  return { success: true as const, ...insights };
}

export async function listChatActionItemsAction(conversationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, items: [] };
  const gate = await assertParticipant(conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, items: [] };
  const items = await listOpenActionItems(conversationId);
  return { success: true as const, items };
}

export async function completeChatActionItemAction(input: {
  conversationId: string;
  itemId: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false };
  const ok = await completeActionItem({
    itemId: input.itemId,
    userId: authUser.id,
    conversationId: input.conversationId,
  });
  revalidatePath(`/messages/${input.conversationId}`);
  revalidatePath(`/business/messages/${input.conversationId}`);
  return { success: ok };
}

export async function correctChatExtractionAction(input: {
  conversationId: string;
  extractionId: string;
  fieldValue: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false };
  const ok = await correctExtraction({
    ...input,
    userId: authUser.id,
  });
  return { success: ok };
}

export async function trackChatAiPanelOpenedAction(conversationId: string) {
  const authUser = await getAuthUser();
  if (!authUser || !isAiChatAssistantEnabled()) return { success: false };
  void emitAiLearningEvent({
    eventType: "chat_ai_panel_opened",
    customerId: authUser.id,
    metadata: { conversationId },
  });
  return { success: true };
}
