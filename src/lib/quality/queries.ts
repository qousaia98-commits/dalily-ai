/**
 * Quality case list queries for admin / customer / provider.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mapQualityCase } from "@/lib/quality/map";
import type { QualityCase, QualityCaseStatus } from "@/lib/quality/types";

export async function listQualityCasesForAdmin(params?: {
  status?: QualityCaseStatus | "all";
  priority?: string;
  limit?: number;
}): Promise<QualityCase[]> {
  const admin = createAdminClient();
  let query = admin
    .from("quality_cases")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params?.priority) {
    query = query.eq("priority", params.priority);
  }

  const { data } = await query;
  return (data ?? []).map(mapQualityCase);
}

export async function listQualityCasesForCustomer(
  customerId: string,
): Promise<QualityCase[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quality_cases")
    .select("*")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map(mapQualityCase);
}

export async function listQualityCasesForProvider(
  providerId: string,
): Promise<QualityCase[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quality_cases")
    .select("*")
    .eq("provider_id", providerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map(mapQualityCase);
}

export async function countOpenQualityCases(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("quality_cases")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", [
        "open",
        "pending_information",
        "under_review",
        "waiting_for_provider",
        "waiting_for_customer",
        "escalated",
      ]);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type AdminQualityDashboard = {
  openCount: number;
  escalatedCount: number;
  resolvedThisWeek: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  recent: QualityCase[];
};

export async function getAdminQualityDashboard(): Promise<AdminQualityDashboard> {
  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data } = await admin
    .from("quality_cases")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []).map(mapQualityCase);
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let openCount = 0;
  let escalatedCount = 0;
  let resolvedThisWeek = 0;

  for (const c of rows) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (
      ["open", "pending_information", "under_review", "waiting_for_provider", "waiting_for_customer"].includes(
        c.status,
      )
    ) {
      openCount += 1;
    }
    if (c.status === "escalated") escalatedCount += 1;
    if (
      (c.status === "resolved" || c.status === "closed") &&
      c.resolvedAt &&
      c.resolvedAt >= weekAgo
    ) {
      resolvedThisWeek += 1;
    }
  }

  return {
    openCount,
    escalatedCount,
    resolvedThisWeek,
    byCategory,
    byStatus,
    recent: rows.slice(0, 30),
  };
}
