import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Marketplace v2 access — never use service_requests.provider_id.
 * Authority comes from unlock grant, unlocked selection, or succeeded unlock session.
 */
export async function getMarketplaceAssignedProviderId(
  serviceRequestId: string,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: grant } = await admin
    .from("contact_release_grants")
    .select("provider_id")
    .eq("service_request_id", serviceRequestId)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (grant?.provider_id) return grant.provider_id as string;

  const { data: selection } = await admin
    .from("marketplace_selections")
    .select("provider_id, status")
    .eq("service_request_id", serviceRequestId)
    .in("status", ["unlocked", "pending_unlock"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selection?.provider_id) return selection.provider_id as string;

  const { data: session } = await admin
    .from("unlock_sessions")
    .select("provider_id")
    .eq("service_request_id", serviceRequestId)
    .eq("status", "succeeded")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (session?.provider_id as string) ?? null;
}

export async function providerCanAccessMarketplaceRequest(input: {
  providerId: string;
  serviceRequestId: string;
}): Promise<boolean> {
  const admin = createAdminClient();

  const { data: grant } = await admin
    .from("contact_release_grants")
    .select("id")
    .eq("service_request_id", input.serviceRequestId)
    .eq("provider_id", input.providerId)
    .limit(1)
    .maybeSingle();
  if (grant) return true;

  const { data: selection } = await admin
    .from("marketplace_selections")
    .select("id")
    .eq("service_request_id", input.serviceRequestId)
    .eq("provider_id", input.providerId)
    .in("status", ["unlocked", "pending_unlock"])
    .limit(1)
    .maybeSingle();
  if (selection) return true;

  const { data: session } = await admin
    .from("unlock_sessions")
    .select("id")
    .eq("service_request_id", input.serviceRequestId)
    .eq("provider_id", input.providerId)
    .in("status", ["succeeded", "opened", "payment_pending"])
    .limit(1)
    .maybeSingle();
  return Boolean(session);
}

/** True when contact is released and work may proceed (chat / completion). */
export async function marketplaceJobIsUnlocked(input: {
  providerId: string;
  serviceRequestId: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("contact_release_grants")
    .select("id")
    .eq("service_request_id", input.serviceRequestId)
    .eq("provider_id", input.providerId)
    .limit(1)
    .maybeSingle();
  return Boolean(grant);
}
