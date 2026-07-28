/**
 * Sprint 7 — Chat authorization against contact_release_grants.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isChatEngineEnabled } from "@/lib/config/feature-flags";
import { canChat as canChatLegacyStatus } from "@/lib/service-requests/status-machine";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";

function scopeIncludesChat(scope: unknown): boolean {
  if (Array.isArray(scope)) return scope.includes("chat");
  if (typeof scope === "string") return scope.includes("chat");
  return false;
}

/**
 * Server-side full-chat gate.
 * - Flag off: legacy status machine.
 * - Flag on + lifecycle >= 2: require contact_release_grant with chat scope.
 * - Flag on + lifecycle < 2: grant OR legacy status (dual-run).
 */
export async function canAccessFullChat(input: {
  serviceRequestId: string | null | undefined;
  status?: ServiceRequestStatus | null;
  lifecycleVersion?: number | null;
}): Promise<boolean> {
  if (!input.serviceRequestId) return true; // non-request threads (e.g. official)

  if (!isChatEngineEnabled()) {
    if (!input.status) return false;
    return canChatLegacyStatus(input.status);
  }

  const lifecycle = input.lifecycleVersion ?? 2;
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("contact_release_grants")
    .select("id, scope")
    .eq("service_request_id", input.serviceRequestId)
    .maybeSingle();

  // Grant authorizes full chat only when scope includes "chat" (default unlock scope does).
  if (grant && scopeIncludesChat(grant.scope)) return true;

  if (lifecycle < 2 && input.status) {
    return canChatLegacyStatus(input.status);
  }

  return false;
}

/**
 * Strict participant check for marketplace chats: only customer + selected provider owner
 * (+ admin_user for admin/support scopes, or conversation_participants row).
 */
export async function assertChatParticipants(input: {
  conversationId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      serviceRequestId: string | null;
      providerId: string;
      customerId: string;
      providerOwnerId: string | null;
      chatScope: string | null;
      adminUserId: string | null;
    }
  | { ok: false; error: "not_found" | "forbidden" | "chat_locked" }
> {
  const supabase = await createClient();
  // Sprint 5 columns — cast until Database types regenerate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convRaw } = await (supabase as any)
    .from("conversations")
    .select(
      "id, provider_id, customer_id, service_request_id, thread_kind, chat_scope, admin_user_id",
    )
    .eq("id", input.conversationId)
    .maybeSingle();

  const conv = convRaw as {
    id: string;
    provider_id: string;
    customer_id: string;
    service_request_id: string | null;
    thread_kind: string | null;
    chat_scope: string | null;
    admin_user_id: string | null;
  } | null;

  if (!conv) return { ok: false, error: "not_found" };

  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();

  const isCustomer = input.userId === conv.customer_id;
  const isProviderOwner = input.userId === providerRow?.owner_id;
  const isAdmin = input.userId === conv.admin_user_id;

  let isParticipantRow = false;
  if (!isCustomer && !isProviderOwner && !isAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cp } = await (supabase as any)
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", input.conversationId)
      .eq("user_id", input.userId)
      .is("deleted_at", null)
      .maybeSingle();
    isParticipantRow = Boolean(cp?.user_id);
  }

  if (!isCustomer && !isProviderOwner && !isAdmin && !isParticipantRow) {
    return { ok: false, error: "forbidden" };
  }

  const scope = (conv.chat_scope as string | null) ?? null;
  const nonRequestScope =
    scope != null &&
    scope !== "request" &&
    ["project", "package", "emergency", "admin", "support"].includes(scope);

  if (!conv.service_request_id || nonRequestScope) {
    return {
      ok: true,
      serviceRequestId: (conv.service_request_id as string | null) ?? null,
      providerId: conv.provider_id as string,
      customerId: conv.customer_id as string,
      providerOwnerId: (providerRow?.owner_id as string) ?? null,
      chatScope: scope,
      adminUserId: (conv.admin_user_id as string | null) ?? null,
    };
  }

  const { data: request } = await supabase
    .from("service_requests")
    .select("id, status, lifecycle_version, customer_id, provider_id")
    .eq("id", conv.service_request_id)
    .maybeSingle();

  if (!request) return { ok: false, error: "chat_locked" };

  // Tenant: only request customer + conversation provider (selected)
  if (isCustomer && request.customer_id !== input.userId) {
    return { ok: false, error: "forbidden" };
  }

  const allowed = await canAccessFullChat({
    serviceRequestId: request.id as string,
    status: request.status as ServiceRequestStatus,
    lifecycleVersion: (request.lifecycle_version as number) ?? 1,
  });

  if (!allowed) return { ok: false, error: "chat_locked" };

  return {
    ok: true,
    serviceRequestId: conv.service_request_id as string,
    providerId: conv.provider_id as string,
    customerId: conv.customer_id as string,
    providerOwnerId: (providerRow?.owner_id as string) ?? null,
    chatScope: scope,
    adminUserId: (conv.admin_user_id as string | null) ?? null,
  };
}
