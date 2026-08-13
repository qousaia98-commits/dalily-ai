import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deliverMarketplaceNotification } from "@/lib/notifications/deliver";
import { syncMarketplaceRequestProjection } from "@/domains/marketplace/projection";
import {
  getMarketplaceAssignedProviderId,
  marketplaceJobIsUnlocked,
  providerCanAccessMarketplaceRequest,
} from "@/domains/marketplace/access";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";

export type MarketplaceCompletionResult =
  | { ok: true; status: ServiceRequestStatus; conversationId: string | null }
  | { ok: false; error: string };

async function getConversationId(requestId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("service_request_id", requestId)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * Advance marketplace-native request into in_progress after unlock grant.
 * Does not set provider_id (ACL remains grant/selection based).
 */
export async function markMarketplaceJobInProgress(
  serviceRequestId: string,
): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("service_requests")
    .update({
      status: "in_progress",
      in_progress_at: now,
      updated_at: now,
    })
    .eq("id", serviceRequestId)
    .eq("lifecycle_version", 2)
    .in("status", ["pending", "accepted"]);

  void syncMarketplaceRequestProjection({
    serviceRequestId,
    legacyStatus: "in_progress",
    lifecycleVersion: 2,
    phase: "in_progress",
  });
}

/**
 * Provider marks work done — authorized via unlock grant, not provider_id.
 */
export async function completeMarketplaceJobByProvider(input: {
  serviceRequestId: string;
  providerId: string;
  actorUserId: string;
}): Promise<MarketplaceCompletionResult> {
  const unlocked = await marketplaceJobIsUnlocked({
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
  });
  if (!unlocked) {
    const canAccess = await providerCanAccessMarketplaceRequest({
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
    });
    if (!canAccess) return { ok: false, error: "forbidden" };
    return { ok: false, error: "not_unlocked" };
  }

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("service_requests")
    .select("id, customer_id, title, status, lifecycle_version, in_progress_at")
    .eq("id", input.serviceRequestId)
    .eq("lifecycle_version", 2)
    .maybeSingle();

  if (!request) return { ok: false, error: "not_found" };
  if (
    !["in_progress", "accepted", "quote_accepted", "quote_declined", "disputed"].includes(
      request.status as string,
    )
  ) {
    return { ok: false, error: "invalid_status" };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("service_requests")
    .update({
      status: "completed_by_business",
      completed_by_business_at: now,
      in_progress_at: (request.in_progress_at as string) ?? now,
      updated_at: now,
    })
    .eq("id", input.serviceRequestId)
    .in("status", ["in_progress", "accepted", "quote_accepted", "quote_declined", "disputed"])
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "invalid_status" };

  void syncMarketplaceRequestProjection({
    serviceRequestId: input.serviceRequestId,
    legacyStatus: "completed_by_business",
    lifecycleVersion: 2,
    phase: "completed",
  });

  const conversationId = await getConversationId(input.serviceRequestId);
  await deliverMarketplaceNotification({
    userId: request.customer_id as string,
    type: "service_completed",
    titleKey: "notifications.serviceCompleted.title",
    bodyKey: "notifications.serviceCompleted.body",
    href: conversationId
      ? `/messages/${conversationId}`
      : `/account/requests/${input.serviceRequestId}`,
    requestId: input.serviceRequestId,
    bodyParams: { title: (request.title as string) ?? "" },
  });

  return { ok: true, status: "completed_by_business", conversationId };
}

/**
 * Customer confirms completion on marketplace-native request.
 */
export async function confirmMarketplaceJobByCustomer(input: {
  serviceRequestId: string;
  customerId: string;
}): Promise<MarketplaceCompletionResult> {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("service_requests")
    .select("id, customer_id, title, status, lifecycle_version, accepted_at, in_progress_at")
    .eq("id", input.serviceRequestId)
    .eq("customer_id", input.customerId)
    .eq("lifecycle_version", 2)
    .maybeSingle();

  if (!request) return { ok: false, error: "not_found" };
  if (request.status !== "completed_by_business") {
    return { ok: false, error: "invalid_status" };
  }

  const providerId = await getMarketplaceAssignedProviderId(input.serviceRequestId);
  const now = new Date();
  const startIso =
    (request.in_progress_at as string | null) ?? (request.accepted_at as string | null);
  const completionSeconds = startIso
    ? Math.max(0, Math.floor((now.getTime() - new Date(startIso).getTime()) / 1000))
    : null;

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      confirmed_at: now.toISOString(),
      completion_time_seconds: completionSeconds,
      updated_at: now.toISOString(),
    })
    .eq("id", input.serviceRequestId)
    .eq("status", "completed_by_business")
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "invalid_status" };

  void syncMarketplaceRequestProjection({
    serviceRequestId: input.serviceRequestId,
    legacyStatus: "completed",
    lifecycleVersion: 2,
    phase: "completed",
  });

  const conversationId = await getConversationId(input.serviceRequestId);
  if (providerId) {
    const { data: provider } = await admin
      .from("providers")
      .select("owner_id")
      .eq("id", providerId)
      .maybeSingle();
    if (provider?.owner_id) {
      await deliverMarketplaceNotification({
        userId: provider.owner_id as string,
        type: "completion_confirmed",
        titleKey: "notifications.completionConfirmed.title",
        bodyKey: "notifications.completionConfirmed.body",
        href: conversationId
          ? `/business/messages/${conversationId}`
          : `/business/requests/${input.serviceRequestId}`,
        requestId: input.serviceRequestId,
        bodyParams: { title: (request.title as string) ?? "" },
      });
    }
  }

  return { ok: true, status: "completed", conversationId };
}

/**
 * Resolve provider_id for reviews on marketplace-native rows (from grant/selection).
 */
export async function resolveMarketplaceReviewProviderId(
  serviceRequestId: string,
): Promise<string | null> {
  return getMarketplaceAssignedProviderId(serviceRequestId);
}
