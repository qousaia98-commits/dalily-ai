import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";

export type AuditAction = Database["public"]["Enums"]["audit_action"];

export async function logAdminAudit(params: {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, Json | undefined>;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: (params.metadata ?? {}) as Json,
  });
}
