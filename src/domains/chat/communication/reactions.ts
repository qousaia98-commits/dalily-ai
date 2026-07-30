/**
 * Message reactions — server-side only writes.
 */

import { createClient } from "@/lib/supabase/server";
import type { MessageReactionSummary } from "./types";

const ALLOWED = new Set(["👍", "❤️", "😂", "🙏", "👏", "🔥", "😮", "😢"]);

export async function listReactionsForMessages(input: {
  messageIds: string[];
  userId: string;
}): Promise<Map<string, MessageReactionSummary[]>> {
  const map = new Map<string, MessageReactionSummary[]>();
  if (input.messageIds.length === 0) return map;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", input.messageIds);

  const agg = new Map<string, Map<string, { count: number; me: boolean }>>();
  for (const row of (data ?? []) as Array<{
    message_id: string;
    emoji: string;
    user_id: string;
  }>) {
    if (!agg.has(row.message_id)) agg.set(row.message_id, new Map());
    const em = agg.get(row.message_id)!;
    const prev = em.get(row.emoji) ?? { count: 0, me: false };
    prev.count += 1;
    if (row.user_id === input.userId) prev.me = true;
    em.set(row.emoji, prev);
  }

  for (const [msgId, emojis] of agg) {
    map.set(
      msgId,
      [...emojis.entries()].map(([emoji, v]) => ({
        emoji,
        count: v.count,
        reactedByMe: v.me,
      })),
    );
  }
  return map;
}

export async function toggleMessageReaction(input: {
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
}): Promise<{ ok: true; added: boolean } | { ok: false; error: string }> {
  if (!ALLOWED.has(input.emoji)) return { ok: false, error: "invalid_emoji" };
  if (!/^[0-9a-f-]{36}$/i.test(input.messageId)) {
    return { ok: false, error: "validation_error" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: existing } = await client
    .from("message_reactions")
    .select("id")
    .eq("message_id", input.messageId)
    .eq("user_id", input.userId)
    .eq("emoji", input.emoji)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: "update_failed" };
    return { ok: true, added: false };
  }

  const { error } = await client.from("message_reactions").insert({
    message_id: input.messageId,
    conversation_id: input.conversationId,
    user_id: input.userId,
    emoji: input.emoji,
  });
  if (error) return { ok: false, error: "update_failed" };
  return { ok: true, added: true };
}
