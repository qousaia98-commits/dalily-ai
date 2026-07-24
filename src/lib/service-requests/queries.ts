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

function mapRequest(row: Record<string, unknown>): ServiceRequestRow {
  return {
    id: row.id as string,
    customer_id: row.customer_id as string,
    provider_id: row.provider_id as string,
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
  let query = supabase
    .from("service_requests")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  if (tab !== "all") {
    query = query.in("status", statusesForTab(tab));
  }

  if (search.trim()) {
    const escaped = search.trim().replace(/[%_,]/g, "\\$&");
    query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error || !data?.length) return [];
  return hydrateDetails(data as Record<string, unknown>[]);
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
  const providerIds = [...new Set(rows.map((r) => r.provider_id as string))];

  const [{ data: profiles }, { data: providers }, imagesByRequest, quotesByRequest, { data: conversations }, { data: reviews }] =
    await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", customerIds),
      supabase.from("providers").select("id, name").in("id", providerIds),
      loadRequestImages(requestIds),
      loadLatestQuotes(requestIds),
      supabase
        .from("conversations")
        .select("id, service_request_id")
        .in("service_request_id", requestIds),
      supabase.from("service_reviews").select("*").in("service_request_id", requestIds),
    ]);

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
  for (const r of reviews ?? []) {
    reviewMap.set(r.service_request_id, {
      id: r.id,
      service_request_id: r.service_request_id,
      provider_id: r.provider_id,
      customer_id: r.customer_id,
      rating: r.rating,
      comment: r.comment,
      recommend: r.recommend,
      created_at: r.created_at,
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

  return rows.map((row) => {
    const mapped = mapRequest(row);
    const paths = imagesByRequest.get(mapped.id) ?? [];
    const imageUrls = paths
      .map((path) => signedByPath.get(path))
      .filter((url): url is string => Boolean(url));
    return {
      ...mapped,
      customerName: profileMap.get(mapped.customer_id) ?? "Customer",
      providerName: providerMap.get(mapped.provider_id) ?? "Business",
      imagePaths: paths,
      imageUrls,
      quote: quotesByRequest.get(mapped.id) ?? null,
      review: reviewMap.get(mapped.id) ?? null,
      conversationId: convMap.get(mapped.id) ?? null,
    };
  });
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
    };
  }
  return data as ProviderRequestSettings;
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
