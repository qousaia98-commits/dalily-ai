/**
 * Sprint 8 — Provider dashboard home aggregate.
 * Reuses Unlock / Offer / Matching / settings — no duplicated business rules.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOffersV2Enabled,
  isProviderDashboardV2Enabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";
import { listProviderUnlockSessions } from "@/domains/unlock/session";
import type { UnlockSessionView } from "@/domains/unlock/types";
import {
  listProviderOpportunities,
  type ProviderOpportunity,
} from "@/domains/offer/queries";
import { getProviderRequestSettings } from "@/lib/service-requests/queries";
import type { ProviderRequestSettings } from "@/lib/service-requests/types";
import type { MatchReason } from "@/domains/matching/reasons";

export type ProviderDashboardQaItem = {
  offerId: string;
  assignmentId: string | null;
  serviceRequestId: string;
  title: string;
  lastBody: string;
  createdAt: string;
};

export type ProviderDashboardActiveJob = {
  serviceRequestId: string;
  title: string;
  conversationId: string | null;
  grantedAt: string;
};

export type ProviderDashboardReliability = {
  declinedCount: number;
  timedOutCount: number;
};

export type ProviderDashboardHome = {
  unlockPriority: UnlockSessionView[];
  opportunities: ProviderOpportunity[];
  pendingQa: ProviderDashboardQaItem[];
  activeJobs: ProviderDashboardActiveJob[];
  pauseState: ProviderRequestSettings;
  reliability: ProviderDashboardReliability;
};

/**
 * Authoritative home payload for PROVIDER_DASHBOARD_V2.
 * Tenant-scoped to the authenticated provider id only.
 */
export async function getProviderDashboardHome(
  providerId: string,
): Promise<ProviderDashboardHome> {
  if (!isProviderDashboardV2Enabled()) {
    return emptyHome(providerId);
  }

  const [unlockSessions, opportunities, pauseState, reliability, pendingQa, activeJobs] =
    await Promise.all([
      isUnlockV2Enabled() ? listProviderUnlockSessions(providerId) : Promise.resolve([]),
      isOffersV2Enabled() ? listProviderOpportunities(providerId) : Promise.resolve([]),
      getProviderRequestSettings(providerId),
      loadReliability(providerId),
      loadPendingQa(providerId),
      loadActiveJobs(providerId),
    ]);

  const unlockPriority = unlockSessions
    .filter((s) => s.status === "opened" || s.status === "payment_pending")
    .sort(
      (a, b) => new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime(),
    );

  const openFirst = [...opportunities].sort((a, b) => {
    if (a.hasOffer !== b.hasOffer) return a.hasOffer ? 1 : -1;
    return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
  });

  return {
    unlockPriority,
    opportunities: openFirst,
    pendingQa,
    activeJobs,
    pauseState,
    reliability,
  };
}

function emptyHome(providerId: string): ProviderDashboardHome {
  return {
    unlockPriority: [],
    opportunities: [],
    pendingQa: [],
    activeJobs: [],
    pauseState: {
      provider_id: providerId,
      accepting_requests: true,
      max_pending_requests: 50,
      auto_reject_message: null,
      vacation_mode: false,
      estimated_response_hours: 24,
      handles_emergency: true,
    },
    reliability: { declinedCount: 0, timedOutCount: 0 },
  };
}

async function loadReliability(
  providerId: string,
): Promise<ProviderDashboardReliability> {
  if (!isUnlockV2Enabled()) return { declinedCount: 0, timedOutCount: 0 };
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("unlock_reliability_signals")
    .select("signal_type")
    .eq("provider_id", providerId)
    .gte("created_at", since)
    .limit(200);

  let declinedCount = 0;
  let timedOutCount = 0;
  for (const row of data ?? []) {
    if (row.signal_type === "declined") declinedCount += 1;
    if (row.signal_type === "timed_out") timedOutCount += 1;
  }
  return { declinedCount, timedOutCount };
}

async function loadPendingQa(providerId: string): Promise<ProviderDashboardQaItem[]> {
  if (!isOffersV2Enabled()) return [];
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("marketplace_offers")
    .select("id, service_request_id, match_assignment_id")
    .eq("provider_id", providerId)
    .eq("status", "sent")
    .limit(40);
  if (!offers?.length) return [];

  const offerIds = offers.map((o) => o.id as string);
  const { data: clarifications } = await supabase
    .from("offer_clarifications")
    .select("id, offer_id, body, author_role, created_at")
    .in("offer_id", offerIds)
    .order("created_at", { ascending: false })
    .limit(80);

  if (!clarifications?.length) return [];

  const latestByOffer = new Map<string, (typeof clarifications)[0]>();
  for (const c of clarifications) {
    const oid = c.offer_id as string;
    if (!latestByOffer.has(oid)) latestByOffer.set(oid, c);
  }

  const needsReply = [...latestByOffer.entries()].filter(
    ([, c]) => c.author_role === "customer",
  );
  if (!needsReply.length) return [];

  const offerMap = new Map(offers.map((o) => [o.id as string, o]));
  const requestIds = needsReply
    .map(([oid]) => offerMap.get(oid)?.service_request_id as string)
    .filter(Boolean);

  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("service_requests")
    .select("id, title")
    .in("id", requestIds);
  const titles = new Map((requests ?? []).map((r) => [r.id as string, r.title as string]));

  return needsReply.slice(0, 8).map(([offerId, c]) => {
    const offer = offerMap.get(offerId)!;
    return {
      offerId,
      assignmentId: (offer.match_assignment_id as string) || null,
      serviceRequestId: offer.service_request_id as string,
      title: titles.get(offer.service_request_id as string) || "",
      lastBody: (c.body as string) || "",
      createdAt: c.created_at as string,
    };
  });
}

async function loadActiveJobs(
  providerId: string,
): Promise<ProviderDashboardActiveJob[]> {
  if (!isUnlockV2Enabled()) return [];
  const supabase = await createClient();
  const { data: grants } = await supabase
    .from("contact_release_grants")
    .select("service_request_id, granted_at")
    .eq("provider_id", providerId)
    .order("granted_at", { ascending: false })
    .limit(15);
  if (!grants?.length) return [];

  const requestIds = grants.map((g) => g.service_request_id as string);
  const admin = createAdminClient();
  const [{ data: requests }, { data: conversations }] = await Promise.all([
    admin.from("service_requests").select("id, title").in("id", requestIds),
    admin
      .from("conversations")
      .select("id, service_request_id")
      .eq("provider_id", providerId)
      .in("service_request_id", requestIds),
  ]);

  const titles = new Map((requests ?? []).map((r) => [r.id as string, r.title as string]));
  const convByRequest = new Map(
    (conversations ?? []).map((c) => [c.service_request_id as string, c.id as string]),
  );

  return grants.map((g) => {
    const rid = g.service_request_id as string;
    return {
      serviceRequestId: rid,
      title: titles.get(rid) || "",
      conversationId: convByRequest.get(rid) ?? null,
      grantedAt: g.granted_at as string,
    };
  });
}

/** Re-export for UI typing */
export type { MatchReason };
