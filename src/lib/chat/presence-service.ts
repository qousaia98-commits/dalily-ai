import { createClient } from "@/lib/supabase/server";

export async function upsertPresence(
  userId: string,
  status: "online" | "offline",
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("upsert_user_presence", {
    p_user_id: userId,
    p_status: status,
  });
}

export async function getPresenceForUsers(
  userIds: string[],
): Promise<Map<string, { status: "online" | "offline"; lastSeenAt: string }>> {
  const map = new Map<string, { status: "online" | "offline"; lastSeenAt: string }>();
  if (!userIds.length) return map;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("user_presence")
    .select("user_id, status, last_seen_at")
    .in("user_id", userIds);

  for (const row of (data ?? []) as Array<{
    user_id: string;
    status: "online" | "offline";
    last_seen_at: string;
  }>) {
    map.set(row.user_id, { status: row.status, lastSeenAt: row.last_seen_at });
  }
  return map;
}
