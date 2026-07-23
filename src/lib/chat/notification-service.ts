import { createClient } from "@/lib/supabase/server";

export async function markConversationReadServer(
  conversationId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });
}

export async function setTypingStatus(input: {
  conversationId: string;
  userId: string;
  typing: boolean;
}): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  if (input.typing) {
    await client.rpc("touch_conversation_typing", {
      p_conversation_id: input.conversationId,
      p_user_id: input.userId,
    });
  } else {
    await client.rpc("clear_conversation_typing", {
      p_conversation_id: input.conversationId,
      p_user_id: input.userId,
    });
  }
}

export async function listTypingUsers(conversationId: string, excludeUserId: string): Promise<
  Array<{ userId: string; displayName: string | null }>
> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("conversation_typing")
    .select("user_id, expires_at")
    .eq("conversation_id", conversationId)
    .gt("expires_at", new Date().toISOString());

  const rows = (data ?? []) as Array<{ user_id: string }>;
  const ids = rows.map((r) => r.user_id).filter((id) => id !== excludeUserId);
  if (!ids.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", ids);

  return (profiles ?? []).map((p) => ({
    userId: p.user_id,
    displayName: (p.display_name as string) ?? null,
  }));
}
