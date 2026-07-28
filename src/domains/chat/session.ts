/**
 * Idempotent full-chat session creation after contact release grant.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isChatEngineEnabled } from "@/lib/config/feature-flags";

/**
 * Ensures a grant-gated conversation exists for the unlocked request.
 * Idempotent via unique service_request_id on conversations.
 */
export async function ensureFullChatSessionForGrant(input: {
  serviceRequestId: string;
  providerId: string;
  customerId: string;
}): Promise<{ ok: true; conversationId: string; created: boolean } | { ok: false; error: string }> {
  if (!isChatEngineEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }

  const admin = createAdminClient();

  const { data: grant } = await admin
    .from("contact_release_grants")
    .select("id, provider_id, customer_id")
    .eq("service_request_id", input.serviceRequestId)
    .maybeSingle();

  if (!grant) return { ok: false, error: "grant_required" };
  if (grant.provider_id !== input.providerId || grant.customer_id !== input.customerId) {
    return { ok: false, error: "grant_mismatch" };
  }

  const { data: existing } = await admin
    .from("conversations")
    .select("id, thread_kind")
    .eq("service_request_id", input.serviceRequestId)
    .maybeSingle();

  if (existing?.id) {
    if (existing.thread_kind !== "full") {
      await admin
        .from("conversations")
        .update({ thread_kind: "full" })
        .eq("id", existing.id);
    }
    return { ok: true, conversationId: existing.id as string, created: false };
  }

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      provider_id: input.providerId,
      customer_id: input.customerId,
      service_request_id: input.serviceRequestId,
      thread_kind: "full",
      status: "open",
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: again } = await admin
      .from("conversations")
      .select("id")
      .eq("service_request_id", input.serviceRequestId)
      .maybeSingle();
    if (again?.id) {
      return { ok: true, conversationId: again.id as string, created: false };
    }
  }

  if (error || !created) {
    return { ok: false, error: error?.message ?? "conversation_create_failed" };
  }

  return { ok: true, conversationId: created.id as string, created: true };
}
