/**
 * Sprint 5 Phase 3 — AI Communication Assistant.
 */

export type * from "@/lib/ai/chat/types";
export { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
export {
  getChatAiPreferences,
  upsertChatAiPreferences,
  assertAiAllowed,
} from "@/lib/ai/chat/privacy";
export { generateChatSummary, deleteChatSummaries } from "@/lib/ai/chat/summarize";
export { suggestChatReplies } from "@/lib/ai/chat/replies";
export { translateChatMessage } from "@/lib/ai/chat/translate";
export {
  extractChatInsights,
  listOpenActionItems,
  completeActionItem,
  correctExtraction,
  scoreChatSentiment,
} from "@/lib/ai/chat/insights";

export {
  transcribeChatVoiceBlob,
  persistChatVoiceTranscript,
  getTranscriptForMessage,
  deleteChatVoiceTranscript,
  translateChatVoiceTranscript,
  searchChatVoiceTranscripts,
  buildWaveformPeaks,
} from "@/lib/ai/chat/voice";

export type {
  ChatVoiceTranscript,
  ChatVoiceSearchHit,
} from "@/lib/ai/chat/voice-types";

export async function loadConversationLines(
  conversationId: string,
): Promise<import("@/lib/ai/chat/types").ChatLine[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, customer_id, provider_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return [];

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body_text, created_at, is_system")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  return ((messages ?? []) as Array<{
    id: string;
    sender_id: string;
    body_text: string;
    created_at: string;
    is_system?: boolean;
  }>).map((m) => {
    let senderRole: "customer" | "provider" | "system" | "admin" = "customer";
    if (m.is_system) senderRole = "system";
    else if (m.sender_id === provider?.owner_id) senderRole = "provider";
    else if (m.sender_id === conv.customer_id) senderRole = "customer";
    return {
      id: m.id,
      senderRole,
      bodyText: m.body_text,
      createdAt: m.created_at,
      isSystem: Boolean(m.is_system),
    };
  });
}
