/**
 * Admin fraud / investigation queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { mapFraudEvent, mapInvestigation, mapRiskScore } from "@/lib/fraud/map";
import type { FraudEvent, Investigation, RiskScore } from "@/lib/fraud/types";

export type AdminFraudDashboard = {
  openInvestigations: number;
  escalatedInvestigations: number;
  highRiskEntities: number;
  eventsToday: number;
  recentInvestigations: Investigation[];
  recentEvents: FraudEvent[];
  topRiskScores: RiskScore[];
  byEventType: Record<string, number>;
  byRiskLevel: Record<string, number>;
};

export async function getAdminFraudDashboard(): Promise<AdminFraudDashboard> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [investigations, events, scores] = await Promise.all([
    admin
      .from("investigations")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("fraud_events")
      .select("*")
      .eq("false_positive", false)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("risk_scores")
      .select("*")
      .order("internal_score", { ascending: false })
      .limit(40),
  ]);

  const inv = (investigations.data ?? []).map(mapInvestigation);
  const ev = (events.data ?? []).map(mapFraudEvent);
  const sc = (scores.data ?? []).map(mapRiskScore);

  const byEventType: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  for (const e of ev) {
    byEventType[e.eventType] = (byEventType[e.eventType] ?? 0) + 1;
  }
  for (const s of sc) {
    byRiskLevel[s.riskLevel] = (byRiskLevel[s.riskLevel] ?? 0) + 1;
  }

  return {
    openInvestigations: inv.filter((i) =>
      ["open", "in_progress", "awaiting_info"].includes(i.status),
    ).length,
    escalatedInvestigations: inv.filter((i) => i.status === "escalated").length,
    highRiskEntities: sc.filter((s) =>
      ["high", "critical"].includes(s.riskLevel),
    ).length,
    eventsToday: ev.filter((e) => e.createdAt >= dayAgo).length,
    recentInvestigations: inv.slice(0, 25),
    recentEvents: ev.slice(0, 25),
    topRiskScores: sc.slice(0, 15),
    byEventType,
    byRiskLevel,
  };
}

export async function listConfirmedRelationships(
  entityType: string,
  entityId: string,
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("entity_relationships")
    .select("*")
    .eq("confirmed", true)
    .or(
      `and(from_entity_type.eq.${entityType},from_entity_id.eq.${entityId}),and(to_entity_type.eq.${entityType},to_entity_id.eq.${entityId})`,
    )
    .limit(50);
  return data ?? [];
}
