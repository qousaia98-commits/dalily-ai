import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import { SERVICE_REQUEST_MEDIA_BUCKET } from "@/lib/service-requests/constants";
import {
  statusesForTab,
  type BusinessRequestTab,
  type ServiceRequestStatus,
} from "@/lib/service-requests/status-machine";
import type {
  MarketplaceNotification,
  ProviderRequestSettings,
  QuoteRow,
  ServiceRequestDetail,
  ServiceRequestRow,
  ServiceReviewRow,
} from "@/lib/service-requests/types";
import { attachMarketplaceReadModels } from "@/domains/marketplace/repository";

function mapRequest(row: Record<string, unknown>): ServiceRequestRow {
  return {
    id: row.id as string,
    customer_id: row.customer_id as string,
    provider_id: (row.provider_id as string | null) ?? null,
    title: row.title as string,
    description: row.description as string,
    preferred_date: (row.preferred_date as string | null) ?? null,
    preferred_time: (row.preferred_time as string | null) ?? null,
    budget: row.budget != null ? Number(row.budget) : null,
    location_text: (row.location_text as string | null) ?? null,
    status: row.status as ServiceRequestStatus,
    accepted_at: (row.accepted_at as string | null) ?? null,
    rejected_at: (row.rejected_at as string | null) ?? null,
    quoted_at: (row.quoted_at as string | null) ?? null,
    quote_accepted_at: (row.quote_accepted_at as string | null) ?? null,
    quote_declined_at: (row.quote_declined_at as string | null) ?? null,
    in_progress_at: (row.in_progress_at as string | null) ?? null,
    completed_by_business_at: (row.completed_by_business_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    disputed_at: (row.disputed_at as string | null) ?? null,
    dispute_note: (row.dispute_note as string | null) ?? null,
    response_time_seconds:
      row.response_time_seconds != null ? Number(row.response_time_seconds) : null,
    completion_time_seconds:
      row.completion_time_seconds != null ? Number(row.completion_time_seconds) : null,
    currency: (row.currency as string | null) ?? "SYP",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    lifecycle_version:
      row.lifecycle_version != null ? Number(row.lifecycle_version) : undefined,
    selection_id: (row.selection_id as string | null | undefined) ?? undefined,
    category_id: (row.category_id as string | null | undefined) ?? undefined,
    urgency: (row.urgency as "emergency" | "normal" | null | undefined) ?? undefined,
    city_id: (row.city_id as string | null | undefined) ?? undefined,
    intent_text: (row.intent_text as string | null | undefined) ?? undefined,
    category_confirmed:
      row.category_confirmed != null ? Boolean(row.category_confirmed) : undefined,
    published_at: (row.published_at as string | null | undefined) ?? undefined,
  };
}

async function loadRequestImages(requestIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (requestIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_request_images")
    .select("request_id, path")
    .in("request_id", requestIds)
    .order("sort_order", { ascending: true });
  for (const row of data ?? []) {
    const list = map.get(row.request_id) ?? [];
    list.push(row.path);
    map.set(row.request_id, list);
  }
  return map;
}

async function loadLatestQuotes(requestIds: string[]): Promise<Map<string, QuoteRow>> {
  const map = new Map<string, QuoteRow>();
  if (requestIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("*")
    .in("service_request_id", requestIds)
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    if (map.has(row.service_request_id)) continue;
    map.set(row.service_request_id, {
      id: row.id,
      service_request_id: row.service_request_id,
      provider_id: row.provider_id,
      price: Number(row.price),
      currency: row.currency,
      estimated_duration_text: row.estimated_duration_text,
      notes: row.notes,
      status: row.status as QuoteRow["status"],
      created_at: row.created_at,
      updated_at: row.updated_at,
      responded_at: row.responded_at,
    });
  }
  return map;
}

export async function getPendingRequestsForProvider(providerId: string) {
  return listProviderRequests(providerId, "pending");
}

export async function listProviderRequests(
  providerId: string,
  tab: BusinessRequestTab | "all" = "all",
  search = "",
): Promise<ServiceRequestDetail[]> {
  const supabase = await createClient();

  // Legacy RFQ rows still set provider_id.
  let legacyQuery = supabase
    .from("service_requests")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  if (tab !== "all") {
    legacyQuery = legacyQuery.in("status", statusesForTab(tab));
  }
  if (search.trim()) {
    const escaped = search.trim().replace(/[%_,]/g, "\\$&");
    legacyQuery = legacyQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  const { data: legacyRows } = await legacyQuery;

  // Marketplace v2 keeps provider_id null — load via grants / unlocked selections.
  const [{ data: grants }, { data: selections }] = await Promise.all([
    supabase
      .from("contact_release_grants")
      .select("service_request_id")
      .eq("provider_id", providerId),
    supabase
      .from("marketplace_selections")
      .select("service_request_id")
      .eq("provider_id", providerId)
      .in("status", ["unlocked", "pending_unlock"]),
  ]);

  const assignedIds = [
    ...new Set(
      [
        ...(grants ?? []).map((g) => g.service_request_id as string),
        ...(selections ?? []).map((s) => s.service_request_id as string),
      ].filter(Boolean),
    ),
  ];

  let marketplaceRows: Record<string, unknown>[] = [];
  if (assignedIds.length > 0) {
    let mQuery = supabase
      .from("service_requests")
      .select("*")
      .in("id", assignedIds)
      .is("provider_id", null)
      .order("created_at", { ascending: false });
    if (tab !== "all") {
      mQuery = mQuery.in("status", statusesForTab(tab));
    }
    if (search.trim()) {
      const escaped = search.trim().replace(/[%_,]/g, "\\$&");
      mQuery = mQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }
    const { data } = await mQuery;
    marketplaceRows = (data as Record<string, unknown>[]) ?? [];
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...(legacyRows ?? []), ...marketplaceRows]) {
    byId.set(row.id as string, row as Record<string, unknown>);
  }
  const merged = [...byId.values()].sort(
    (a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
  );
  if (merged.length === 0) return [];
  return hydrateDetails(merged);
}

/**
 * Provider request detail — never requires service_requests.provider_id for v2.
 */
export async function getProviderVisibleRequestDetail(
  requestId: string,
  providerId: string,
): Promise<ServiceRequestDetail | null> {
  const detail = await getRequestDetail(requestId);
  if (detail?.provider_id === providerId) return detail;

  const { providerCanAccessMarketplaceRequest } = await import(
    "@/domains/marketplace/access"
  );
  const canAccess = await providerCanAccessMarketplaceRequest({
    providerId,
    serviceRequestId: requestId,
  });
  if (!canAccess) return null;

  if (detail && (detail.lifecycle_version ?? 1) >= 2) return detail;

  // Fallback when user RLS still hides the row (pre-migration).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) return null;
  const [hydrated] = await hydrateDetails([data as Record<string, unknown>]);
  return hydrated ?? null;
}

export async function listCustomerRequests(userId: string): Promise<ServiceRequestDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data?.length) return [];
  return hydrateDetails(data as Record<string, unknown>[]);
}

export async function getRequestDetail(requestId: string): Promise<ServiceRequestDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) return null;
  const [detail] = await hydrateDetails([data as Record<string, unknown>]);
  return detail ?? null;
}

export async function getRequestByConversationId(
  conversationId: string,
): Promise<ServiceRequestDetail | null> {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("service_request_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv?.service_request_id) return null;
  return getRequestDetail(conv.service_request_id);
}

async function hydrateDetails(
  rows: Record<string, unknown>[],
): Promise<ServiceRequestDetail[]> {
  const supabase = await createClient();
  const requestIds = rows.map((r) => r.id as string);
  const customerIds = [...new Set(rows.map((r) => r.customer_id as string))];
  const providerIds = [
    ...new Set(
      rows
        .map((r) => r.provider_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [profilesRes, providersRes, imagesByRequest, quotesByRequest, conversationsRes, reviewsRes] =
    await Promise.all([
      customerIds.length
        ? supabase.from("profiles").select("user_id, display_name").in("user_id", customerIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
      providerIds.length
        ? supabase.from("providers").select("id, name").in("id", providerIds)
        : Promise.resolve({ data: [] as { id: string; name: unknown }[] }),
      loadRequestImages(requestIds),
      loadLatestQuotes(requestIds),
      requestIds.length
        ? supabase
            .from("conversations")
            .select("id, service_request_id")
            .in("service_request_id", requestIds)
        : Promise.resolve({ data: [] as { id: string; service_request_id: string }[] }),
      requestIds.length
        ? supabase.from("service_reviews").select("*").in("service_request_id", requestIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

  const profiles = profilesRes.data;
  const providers = providersRes.data;
  const conversations = conversationsRes.data;
  const reviews = reviewsRes.data;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.display_name as string]),
  );
  const providerMap = new Map(
    (providers ?? []).map((p) => {
      const name =
        typeof p.name === "object" && p.name !== null
          ? ((p.name as { en?: string }).en ?? (p.name as { ar?: string }).ar ?? "Business")
          : "Business";
      return [p.id, name];
    }),
  );
  const convMap = new Map(
    (conversations ?? []).map((c) => [c.service_request_id as string, c.id as string]),
  );
  const reviewMap = new Map<string, ServiceReviewRow>();
  for (const r of (reviews ?? []) as Array<Record<string, unknown>>) {
    const serviceRequestId = r.service_request_id as string;
    reviewMap.set(serviceRequestId, {
      id: r.id as string,
      service_request_id: serviceRequestId,
      provider_id: r.provider_id as string,
      customer_id: r.customer_id as string,
      rating: r.rating as number,
      comment: (r.comment as string | null) ?? null,
      recommend: (r.recommend as boolean | null) ?? null,
      created_at: r.created_at as string,
    });
  }

  const allPaths = [...imagesByRequest.values()].flat();
  const signedByPath = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .createSignedUrls(allPaths, 3600);
    (signed ?? []).forEach((item, index) => {
      const path = item.path ?? allPaths[index];
      if (path && item.signedUrl) signedByPath.set(path, item.signedUrl);
    });
  }

  return attachMarketplaceReadModels(
    rows.map((row) => {
      const mapped = mapRequest(row);
      const paths = imagesByRequest.get(mapped.id) ?? [];
      const imageUrls = paths
        .map((path) => signedByPath.get(path))
        .filter((url): url is string => Boolean(url));
      return {
        ...mapped,
        customerName: profileMap.get(mapped.customer_id) ?? "Customer",
        providerName: mapped.provider_id
          ? (providerMap.get(mapped.provider_id) ?? "Business")
          : "—",
        imagePaths: paths,
        imageUrls,
        quote: quotesByRequest.get(mapped.id) ?? null,
        review: reviewMap.get(mapped.id) ?? null,
        conversationId: convMap.get(mapped.id) ?? null,
      };
    }),
  );
}

export const countPendingRequestsForOwner = cache(async function countPendingRequestsForOwner(
  userId: string,
): Promise<number> {
  const provider = await getOwnedProvider(userId);
  if (!provider) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", provider.id)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
});

export const countTotalRequestsForProvider = cache(async function countTotalRequestsForProvider(
  providerId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId);
  if (error) return 0;
  return count ?? 0;
});

export async function countTabBadges(providerId: string): Promise<Record<BusinessRequestTab, number>> {
  const supabase = await createClient();
  const tabs: BusinessRequestTab[] = [
    "pending",
    "accepted",
    "quoted",
    "in_progress",
    "completed",
    "rejected",
    "disputed",
  ];
  const result = Object.fromEntries(tabs.map((t) => [t, 0])) as Record<BusinessRequestTab, number>;
  const { data } = await supabase
    .from("service_requests")
    .select("status")
    .eq("provider_id", providerId);
  for (const row of data ?? []) {
    for (const tab of tabs) {
      if (statusesForTab(tab).includes(row.status as ServiceRequestStatus)) {
        result[tab] += 1;
      }
    }
  }
  return result;
}

export async function hasPendingRequest(
  customerId: string,
  providerId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("provider_id", providerId)
    .eq("status", "pending");
  return (count ?? 0) > 0;
}

export async function getProviderRequestSettings(
  providerId: string,
): Promise<ProviderRequestSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_request_settings")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!data) {
    return {
      provider_id: providerId,
      accepting_requests: true,
      max_pending_requests: 50,
      auto_reject_message: null,
      vacation_mode: false,
      estimated_response_hours: 24,
      handles_emergency: true,
    };
  }
  return {
    ...(data as ProviderRequestSettings),
    handles_emergency:
      (data as { handles_emergency?: boolean | null }).handles_emergency ?? true,
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("marketplace_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

const VERIFICATION_NOTIFY_TYPES = [
  "verification_approved",
  "verification_rejected",
  "verification_changes_requested",
  "verification_resubmitted",
] as const;

export async function getUnreadVerificationNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("marketplace_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...VERIFICATION_NOTIFY_TYPES]);
  return count ?? 0;
}

export async function markVerificationNotificationsRead(
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from("marketplace_notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...VERIFICATION_NOTIFY_TYPES]);
}

export async function listNotifications(
  userId: string,
  limit = 30,
): Promise<MarketplaceNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketplace_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((n) => ({
    id: n.id,
    user_id: n.user_id,
    type: n.type,
    title_key: n.title_key,
    body_key: n.body_key,
    body_params: (n.body_params ?? {}) as Record<string, string | number>,
    href: n.href,
    service_request_id: n.service_request_id,
    conversation_id: n.conversation_id,
    read_at: n.read_at,
    created_at: n.created_at,
  }));
}

export async function getCustomerRequests(userId: string): Promise<ServiceRequestRow[]> {
  const details = await listCustomerRequests(userId);
  return details;
}
