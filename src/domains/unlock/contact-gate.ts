import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUnlockV2Enabled } from "@/lib/config/feature-flags";
import type {
  ContactReleaseGrantView,
  ReleasedContact,
} from "@/domains/unlock/types";

/**
 * Fail-closed contact gate: no phone/whatsapp/address without a grant row.
 */
export async function getContactReleaseGrantForRequest(
  serviceRequestId: string,
): Promise<ContactReleaseGrantView | null> {
  if (!isUnlockV2Enabled()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_release_grants")
    .select("*")
    .eq("service_request_id", serviceRequestId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    unlockSessionId: data.unlock_session_id as string,
    serviceRequestId: data.service_request_id as string,
    providerId: data.provider_id as string,
    customerId: data.customer_id as string,
    scope: Array.isArray(data.scope) ? (data.scope as string[]) : [],
    grantedAt: data.granted_at as string,
  };
}

/**
 * Returns provider contact fields only when the authenticated customer holds a grant.
 * Uses admin hydrate for provider PII after grant ownership is verified under session RLS.
 */
export async function getReleasedContactForCustomer(input: {
  customerId: string;
  serviceRequestId: string;
}): Promise<ReleasedContact | null> {
  if (!isUnlockV2Enabled()) return null;

  const supabase = await createClient();
  const { data: grant } = await supabase
    .from("contact_release_grants")
    .select("id, provider_id, customer_id, service_request_id")
    .eq("service_request_id", input.serviceRequestId)
    .eq("customer_id", input.customerId)
    .maybeSingle();

  if (!grant) return null;

  const admin = createAdminClient();
  const { data: provider } = await admin
    .from("providers")
    .select("phone, whatsapp, address_line")
    .eq("id", grant.provider_id)
    .maybeSingle();

  if (!provider) return null;

  return {
    phone: (provider.phone as string) ?? null,
    whatsapp: (provider.whatsapp as string) ?? null,
    addressLine: provider.address_line ?? null,
    grantId: grant.id as string,
  };
}

export async function hasContactReleaseGrant(input: {
  serviceRequestId: string;
}): Promise<boolean> {
  const grant = await getContactReleaseGrantForRequest(input.serviceRequestId);
  return Boolean(grant);
}
