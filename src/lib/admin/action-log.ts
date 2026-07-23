import { createAdminClient } from "@/lib/supabase/admin";

export async function logAdminAction(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("admin_action_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[admin_action_logs]", error);
    }
  }
}

export async function listAdminActionLogs(limit = 50): Promise<
  Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("admin_action_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: (row.entity_id as string) ?? null,
    actorId: (row.actor_id as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }));
}
