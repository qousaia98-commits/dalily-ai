import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditAction, LocalizedJson } from "@/types/database.types";

export type ControlCenterOverview = {
  pendingBusinesses: number;
  pendingPayments: number;
  changesRequested: number;
  unreadMessages: number;
  approvalsToday: number;
  registrationsThisWeek: number;
  approvedToday: number;
  revenueThisMonthUsd: number;
  planCounts: {
    starter: number;
    pro: number;
    premium: number;
  };
};

export type AdminActivityItem = {
  id: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AdminNavBadges = {
  businesses: number;
  payments: number;
  messages: number;
};

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getControlCenterOverview(): Promise<ControlCenterOverview> {
  const admin = createAdminClient();
  const todayStart = startOfUtcDay();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const monthStart = startOfUtcMonth();

  const [
    pendingBusinesses,
    pendingPayments,
    changesRequested,
    approvalsToday,
    registrationsThisWeek,
    approvedToday,
    paidThisMonth,
  ] = await Promise.all([
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .is("deleted_at", null),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "pending_review"),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "changes_requested")
      .is("deleted_at", null),
    admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "provider_approved")
      .gte("created_at", todayStart),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", weekAgo.toISOString()),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("published_at", todayStart),
    admin
      .from("payments")
      .select("amount")
      .eq("payment_status", "paid")
      .gte("approved_at", monthStart),
  ]);

  const revenueThisMonthUsd = (paidThisMonth.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );

  // Plan counts from active subscriptions
  const { data: activeSubs } = await admin
    .from("subscriptions")
    .select("plan_id")
    .eq("status", "active");

  const planIds = [...new Set((activeSubs ?? []).map((s) => s.plan_id))];
  const { data: plans } = planIds.length
    ? await admin.from("subscription_plans").select("id, slug").in("id", planIds)
    : { data: [] as { id: string; slug: string }[] };

  const slugById = new Map((plans ?? []).map((p) => [p.id, p.slug]));
  const planCounts = { starter: 0, pro: 0, premium: 0 };
  for (const sub of activeSubs ?? []) {
    const slug = slugById.get(sub.plan_id) ?? "free";
    if (slug === "pro") planCounts.pro += 1;
    else if (slug === "premium") planCounts.premium += 1;
    else planCounts.starter += 1;
  }

  return {
    pendingBusinesses: pendingBusinesses.count ?? 0,
    pendingPayments: pendingPayments.count ?? 0,
    changesRequested: changesRequested.count ?? 0,
    unreadMessages: 0,
    approvalsToday: approvalsToday.count ?? 0,
    registrationsThisWeek: registrationsThisWeek.count ?? 0,
    approvedToday: approvedToday.count ?? 0,
    revenueThisMonthUsd,
    planCounts,
  };
}

export async function getAdminNavBadges(): Promise<AdminNavBadges> {
  const overview = await getControlCenterOverview();
  return {
    businesses: overview.pendingBusinesses + overview.changesRequested,
    payments: overview.pendingPayments,
    messages: overview.unreadMessages,
  };
}

export async function listAdminActivityFeed(limit = 20): Promise<AdminActivityItem[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows?.length) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const { data: profiles } = actorIds.length
    ? await admin.from("profiles").select("user_id, display_name").in("user_id", actorIds)
    : { data: [] as { user_id: string; display_name: string | null }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorName: nameById.get(row.actor_id) ?? null,
    createdAt: row.created_at,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }));
}

export type ReviewChecklist = {
  companyInfo: boolean;
  logo: boolean;
  cover: boolean;
  gallery: boolean;
  openingHours: boolean;
  location: boolean;
  phone: boolean;
  description: boolean;
  idDocument: boolean;
};

export function buildReviewChecklist(input: {
  name: LocalizedJson;
  about: LocalizedJson | null;
  phone: string | null;
  cityId: string;
  categoryId: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  galleryCount: number;
  hoursConfigured: boolean;
  hasIdDocument: boolean;
}): ReviewChecklist {
  const hasName = Boolean(input.name.ar?.trim() || input.name.en?.trim());
  const hasAbout = Boolean(input.about?.ar?.trim() || input.about?.en?.trim());

  return {
    companyInfo: hasName && Boolean(input.categoryId),
    logo: Boolean(input.avatarUrl),
    cover: Boolean(input.coverUrl),
    gallery: input.galleryCount > 0,
    openingHours: input.hoursConfigured,
    location: Boolean(input.cityId),
    phone: Boolean(input.phone?.trim()),
    description: hasAbout,
    idDocument: input.hasIdDocument,
  };
}
