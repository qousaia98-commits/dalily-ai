/**
 * Sprint 5 Phase 1 — scoped conversation factories + mark-all-read.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { ChatScope } from "@/lib/chat/types";

function adminDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function getOrCreateScopedConversation(input: {
  scope: ChatScope;
  customerId: string;
  providerId: string;
  serviceRequestId?: string | null;
  projectId?: string | null;
  packageId?: string | null;
  adminUserId?: string | null;
  emergencyDispatchId?: string | null;
}): Promise<{ conversationId: string; created: boolean } | null> {
  try {
    const admin = adminDb();

    let query = admin
      .from("conversations")
      .select("id")
      .eq("customer_id", input.customerId)
      .eq("provider_id", input.providerId)
      .eq("chat_scope", input.scope);

    if (input.scope === "request" && input.serviceRequestId) {
      query = query.eq("service_request_id", input.serviceRequestId);
    }
    if (input.scope === "project" && input.projectId) {
      query = query.eq("project_id", input.projectId).is("package_id", null);
    }
    if (input.scope === "package" && input.packageId) {
      query = query.eq("package_id", input.packageId);
    }
    if (input.scope === "emergency" && input.emergencyDispatchId) {
      query = query.eq("emergency_dispatch_id", input.emergencyDispatchId);
    }
    if (
      (input.scope === "admin" || input.scope === "support") &&
      input.adminUserId
    ) {
      query = query.eq("admin_user_id", input.adminUserId);
    }

    const { data: existing } = await query.maybeSingle();
    if (existing?.id) {
      return { conversationId: String(existing.id), created: false };
    }

    const { data: created, error } = await admin
      .from("conversations")
      .insert({
        customer_id: input.customerId,
        provider_id: input.providerId,
        service_request_id: input.serviceRequestId ?? null,
        project_id: input.projectId ?? null,
        package_id: input.packageId ?? null,
        admin_user_id: input.adminUserId ?? null,
        emergency_dispatch_id: input.emergencyDispatchId ?? null,
        chat_scope: input.scope,
        thread_kind: "full",
      })
      .select("id")
      .single();

    if (error || !created?.id) return null;

    void emitAiLearningEvent({
      eventType: "chat_conversation_opened",
      customerId: input.customerId,
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
      metadata: { scope: input.scope, conversationId: created.id },
    });

    return { conversationId: String(created.id), created: true };
  } catch {
    return null;
  }
}

export async function markAllConversationsRead(
  userId: string,
): Promise<number> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "mark_all_conversations_read",
      { p_user_id: userId },
    );
    if (error) return 0;
    void emitAiLearningEvent({
      eventType: "chat_mark_all_read",
      customerId: userId,
      metadata: { updated: data ?? 0 },
    });
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}
