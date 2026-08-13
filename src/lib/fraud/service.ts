/**
 * Fraud service — recalculate risk, emit events, investigations, relationships.
 * Admin-assisted only; never permanent auto-suspend.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeRiskComputation } from "@/lib/fraud/ai-analysis";
import { collectEntityFraudRaw } from "@/lib/fraud/collect";
import { computeRiskFromSignals } from "@/lib/fraud/engine";
import {
  mapFraudEvent,
  mapInvestigation,
  mapInvestigationHistory,
  mapInvestigationNote,
  mapRelationship,
  mapRiskScore,
} from "@/lib/fraud/map";
import { trackFraudEvent } from "@/lib/fraud/observability";
import { DEFAULT_RISK_RULES, mergeRuleWeights } from "@/lib/fraud/weights";
import { isFraudDetectionEnabled } from "@/lib/config/feature-flags";
import {
  canTransitionInvestigation,
  FRAUD_AUTO_ACTIONS,
  FRAUD_EVENT_TYPES,
  type EntityRelationship,
  type FraudAutoAction,
  type FraudEvent,
  type FraudEventType,
  type Investigation,
  type InvestigationHistoryEntry,
  type InvestigationNote,
  type InvestigationStatus,
  type RelationshipType,
  type RiskEntityType,
  type RiskScore,
} from "@/lib/fraud/types";

export type FraudResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function loadRules() {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("risk_rules").select("*");
    if (!data?.length) return DEFAULT_RISK_RULES;
    return mergeRuleWeights(
      DEFAULT_RISK_RULES,
      data.map((r) => ({
        ruleKey: r.rule_key,
        category: r.category,
        weight: Number(r.weight),
        threshold: Number(r.threshold),
        enabled: r.enabled,
        mlReady: r.ml_ready,
        autoActions: (r.auto_actions as FraudAutoAction[]) ?? [],
      })),
    );
  } catch {
    return DEFAULT_RISK_RULES;
  }
}

export async function recalculateEntityRisk(input: {
  entityType: RiskEntityType;
  entityId: string;
  actorId?: string | null;
  mlRiskScore?: number | null;
}): Promise<FraudResult<RiskScore>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const raw = await collectEntityFraudRaw(input);
  if (input.mlRiskScore != null) raw.mlRiskScore = input.mlRiskScore;

  const rules = await loadRules();
  const computation = computeRiskFromSignals({
    entityType: input.entityType,
    entityId: input.entityId,
    raw,
    rules,
    includeMlLayer: true,
  });

  const { data: prior } = await admin
    .from("risk_scores")
    .select("*")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .maybeSingle();

  const { count: priorEvents } = await admin
    .from("fraud_events")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId);

  const analysis = analyzeRiskComputation(computation, {
    priorEventCount: priorEvents ?? 0,
  });

  const signalBreakdown: Record<string, number> = {};
  for (const s of computation.signals) {
    signalBreakdown[s.signalKey] = s.contribution;
  }

  const { data: upserted, error } = await admin
    .from("risk_scores")
    .upsert(
      {
        entity_type: input.entityType,
        entity_id: input.entityId,
        internal_score: computation.internalScore,
        risk_level: computation.riskLevel,
        confidence: computation.confidence,
        explanation: analysis.explanation,
        triggered_rules: computation.triggeredRules,
        suggested_action: computation.suggestedAction,
        related_events: analysis.relatedEvents,
        duplicate_candidates: analysis.duplicateCandidates,
        signal_breakdown: signalBreakdown,
        model_version: computation.modelVersion,
        ml_contribution: computation.mlContribution,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id" },
    )
    .select("*")
    .single();

  if (error || !upserted) return { ok: false, error: "persist_failed" };

  await admin.from("risk_score_history").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_score: prior ? Number(prior.internal_score) : null,
    to_score: computation.internalScore,
    from_level: prior?.risk_level ?? null,
    to_level: computation.riskLevel,
    triggered_rules: computation.triggeredRules,
    actor_id: input.actorId ?? null,
    actor_role: input.actorId ? "admin" : "system",
    reason: "recalculate",
  });

  for (const ruleKey of computation.triggeredRules) {
    const signal = computation.signals.find((s) => s.signalKey === ruleKey);
    await recordFraudEvent({
      eventType: (FRAUD_EVENT_TYPES.includes(ruleKey as FraudEventType)
        ? ruleKey
        : "other") as FraudEventType,
      entityType: input.entityType,
      entityId: input.entityId,
      severity: computation.riskLevel,
      confidence: computation.confidence,
      ruleKey,
      title: `Rule triggered: ${ruleKey}`,
      summary: analysis.explanation,
      source: signal?.source === "ml" ? "ml" : "rule",
      metadata: { contribution: signal?.contribution },
    });
    void trackFraudEvent("rule_triggered", {
      entityType: input.entityType,
      entityId: input.entityId,
      ruleKey,
    });
  }

  // Apply configurable soft actions only (never permanent suspend).
  if (
    computation.suggestedAction !== "none" &&
    FRAUD_AUTO_ACTIONS.includes(computation.suggestedAction)
  ) {
    await applySoftAutoAction({
      action: computation.suggestedAction,
      entityType: input.entityType,
      entityId: input.entityId,
      explanation: analysis.explanation,
    });
  }

  void trackFraudEvent("risk_calculated", {
    entityType: input.entityType,
    entityId: input.entityId,
    riskLevel: computation.riskLevel,
    triggeredCount: computation.triggeredRules.length,
  });

  return { ok: true, data: mapRiskScore(upserted) };
}

export async function recordFraudEvent(input: {
  eventType: FraudEventType;
  entityType: RiskEntityType;
  entityId: string;
  severity?: RiskScore["riskLevel"];
  confidence?: number;
  ruleKey?: string | null;
  title: string;
  summary?: string | null;
  source?: FraudEvent["source"];
  relatedEntityIds?: string[];
  metadata?: Record<string, unknown>;
  investigationId?: string | null;
}): Promise<FraudResult<FraudEvent>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("fraud_events")
    .insert({
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      severity: input.severity ?? "medium",
      confidence: input.confidence ?? 0.5,
      rule_key: input.ruleKey ?? null,
      title: input.title,
      summary: input.summary ?? null,
      source: input.source ?? "system",
      related_entity_ids: input.relatedEntityIds ?? [],
      metadata: (input.metadata ?? {}) as import("@/types/database.types").Json,
      investigation_id: input.investigationId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };
  return { ok: true, data: mapFraudEvent(data) };
}

async function applySoftAutoAction(input: {
  action: FraudAutoAction;
  entityType: RiskEntityType;
  entityId: string;
  explanation: string;
}): Promise<void> {
  // Soft actions only: flag / require review / re-verify / temp restrict / escalate.
  // Permanent suspension is intentionally unsupported.
  const admin = createAdminClient();
  await admin.from("fraud_events").insert({
    event_type: "other",
    entity_type: input.entityType,
    entity_id: input.entityId,
    severity: input.action === "escalate_to_admin" ? "high" : "medium",
    confidence: 0.7,
    rule_key: `auto:${input.action}`,
    title: `Auto action: ${input.action}`,
    summary: input.explanation,
    source: "system",
    metadata: { autoAction: input.action, permanentSuspend: false },
  });

  if (input.action === "escalate_to_admin" || input.action === "require_manual_review") {
    const existing = await admin
      .from("investigations")
      .select("id")
      .eq("primary_entity_type", input.entityType)
      .eq("primary_entity_id", input.entityId)
      .in("status", ["open", "in_progress", "awaiting_info", "escalated"])
      .maybeSingle();

    if (!existing.data) {
      await createInvestigation({
        title: `Auto: ${input.action} — ${input.entityType}:${input.entityId}`,
        primaryEntityType: input.entityType,
        primaryEntityId: input.entityId,
        priority: input.action === "escalate_to_admin" ? "high" : "medium",
        createdBy: null,
        status: input.action === "escalate_to_admin" ? "escalated" : "open",
      });
    }
  }
}

export async function createInvestigation(input: {
  title: string;
  primaryEntityType: RiskEntityType;
  primaryEntityId: string;
  relatedEntityIds?: string[];
  priority?: Investigation["priority"];
  createdBy: string | null;
  status?: InvestigationStatus;
}): Promise<FraudResult<Investigation>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  const { data: caseNumber } = await admin.rpc("next_investigation_number");
  const number =
    typeof caseNumber === "string" ? caseNumber : `INV-${Date.now()}`;

  const { data, error } = await admin
    .from("investigations")
    .insert({
      case_number: number,
      title: input.title.trim().slice(0, 200),
      status: input.status ?? "open",
      priority: input.priority ?? "medium",
      primary_entity_type: input.primaryEntityType,
      primary_entity_id: input.primaryEntityId,
      related_entity_ids: input.relatedEntityIds ?? [],
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };

  await admin.from("investigation_history").insert({
    investigation_id: data.id,
    from_status: null,
    to_status: data.status,
    action: "created",
    actor_id: input.createdBy,
    note: "Investigation opened",
  });

  void trackFraudEvent("investigation_created", {
    investigationId: data.id,
    entityType: input.primaryEntityType,
    entityId: input.primaryEntityId,
  });

  return { ok: true, data: mapInvestigation(data) };
}

export async function transitionInvestigation(input: {
  investigationId: string;
  toStatus: InvestigationStatus;
  actorId: string;
  note?: string;
  outcome?: string;
}): Promise<FraudResult<Investigation>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("investigations")
    .select("*")
    .eq("id", input.investigationId)
    .maybeSingle();
  if (!current) return { ok: false, error: "not_found" };

  const from = current.status as InvestigationStatus;
  if (!canTransitionInvestigation(from, input.toStatus)) {
    return { ok: false, error: "invalid_transition" };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: now,
  };
  if (input.outcome) patch.outcome = input.outcome;
  if (
    input.toStatus === "resolved" ||
    input.toStatus === "closed" ||
    input.toStatus === "false_positive"
  ) {
    patch.closed_at = now;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (admin as any)
    .from("investigations")
    .update(patch)
    .eq("id", input.investigationId)
    .select("*")
    .single();

  if (error || !updated) return { ok: false, error: "update_failed" };

  await admin.from("investigation_history").insert({
    investigation_id: input.investigationId,
    from_status: from,
    to_status: input.toStatus,
    action:
      input.toStatus === "false_positive"
        ? "false_positive"
        : input.toStatus === "resolved" || input.toStatus === "closed"
          ? "resolved"
          : input.toStatus === "escalated"
            ? "escalated"
            : "status_changed",
    actor_id: input.actorId,
    note: input.note ?? null,
  });

  if (input.toStatus === "false_positive") {
    await admin
      .from("fraud_events")
      .update({ false_positive: true, resolved_at: now })
      .eq("investigation_id", input.investigationId);
    void trackFraudEvent("false_positive", {
      investigationId: input.investigationId,
    });
  }

  if (input.toStatus === "resolved" || input.toStatus === "closed") {
    void trackFraudEvent("investigation_resolved", {
      investigationId: input.investigationId,
    });
  }

  return { ok: true, data: mapInvestigation(updated) };
}

export async function assignInvestigation(input: {
  investigationId: string;
  adminId: string;
  actorId: string;
  note?: string;
}): Promise<FraudResult<Investigation>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("investigations")
    .update({
      assigned_admin_id: input.adminId,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.investigationId)
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "update_failed" };

  await admin.from("investigation_history").insert({
    investigation_id: input.investigationId,
    from_status: null,
    to_status: "in_progress",
    action: "assigned",
    actor_id: input.actorId,
    note: input.note ?? `Assigned to ${input.adminId}`,
  });

  return { ok: true, data: mapInvestigation(data) };
}

export async function addInvestigationNote(input: {
  investigationId: string;
  authorId: string;
  body: string;
}): Promise<FraudResult<InvestigationNote>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const body = input.body.trim();
  if (body.length < 2) return { ok: false, error: "validation_error" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("investigation_notes")
    .insert({
      investigation_id: input.investigationId,
      author_id: input.authorId,
      body: body.slice(0, 4000),
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };

  await admin.from("investigation_history").insert({
    investigation_id: input.investigationId,
    action: "note_added",
    actor_id: input.authorId,
    note: body.slice(0, 200),
  });

  return { ok: true, data: mapInvestigationNote(data) };
}

export async function mergeInvestigations(input: {
  sourceId: string;
  targetId: string;
  actorId: string;
}): Promise<FraudResult<Investigation>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  if (input.sourceId === input.targetId) {
    return { ok: false, error: "validation_error" };
  }
  const admin = createAdminClient();

  const { data: source } = await admin
    .from("investigations")
    .select("*")
    .eq("id", input.sourceId)
    .maybeSingle();
  const { data: target } = await admin
    .from("investigations")
    .select("*")
    .eq("id", input.targetId)
    .maybeSingle();
  if (!source || !target) return { ok: false, error: "not_found" };

  const related = new Set([
    ...((target.related_entity_ids as string[]) ?? []),
    ...((source.related_entity_ids as string[]) ?? []),
    `${source.primary_entity_type}:${source.primary_entity_id}`,
  ]);

  await admin
    .from("investigations")
    .update({
      related_entity_ids: [...related],
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.targetId);

  await admin
    .from("investigations")
    .update({
      merged_into_id: input.targetId,
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      outcome: `Merged into ${target.case_number}`,
    })
    .eq("id", input.sourceId);

  await admin
    .from("fraud_events")
    .update({ investigation_id: input.targetId })
    .eq("investigation_id", input.sourceId);

  await admin.from("investigation_history").insert({
    investigation_id: input.targetId,
    action: "merged",
    actor_id: input.actorId,
    note: `Merged ${source.case_number} into ${target.case_number}`,
  });

  const { data: updated } = await admin
    .from("investigations")
    .select("*")
    .eq("id", input.targetId)
    .single();

  return { ok: true, data: mapInvestigation(updated!) };
}

export async function confirmEntityRelationship(input: {
  fromEntityType: RiskEntityType;
  fromEntityId: string;
  toEntityType: RiskEntityType;
  toEntityId: string;
  relationshipType: RelationshipType;
  confidence?: number;
  evidence?: Record<string, unknown>;
}): Promise<FraudResult<EntityRelationship>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("entity_relationships")
    .upsert(
      {
        from_entity_type: input.fromEntityType,
        from_entity_id: input.fromEntityId,
        to_entity_type: input.toEntityType,
        to_entity_id: input.toEntityId,
        relationship_type: input.relationshipType,
        confirmed: true,
        confidence: input.confidence ?? 0.8,
        evidence: (input.evidence ?? {}) as import("@/types/database.types").Json,
      },
      {
        onConflict:
          "from_entity_type,from_entity_id,to_entity_type,to_entity_id,relationship_type",
      },
    )
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };
  return { ok: true, data: mapRelationship(data) };
}

export async function getInvestigationDetail(id: string): Promise<{
  investigation: Investigation;
  notes: InvestigationNote[];
  history: InvestigationHistoryEntry[];
  events: FraudEvent[];
  relationships: EntityRelationship[];
  risk: RiskScore | null;
} | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("investigations")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;

  const [notes, history, events, rels, risk] = await Promise.all([
    admin
      .from("investigation_notes")
      .select("*")
      .eq("investigation_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("investigation_history")
      .select("*")
      .eq("investigation_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("fraud_events")
      .select("*")
      .eq("investigation_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("entity_relationships")
      .select("*")
      .eq("confirmed", true)
      .or(
        `and(from_entity_type.eq.${row.primary_entity_type},from_entity_id.eq.${row.primary_entity_id}),and(to_entity_type.eq.${row.primary_entity_type},to_entity_id.eq.${row.primary_entity_id})`,
      ),
    admin
      .from("risk_scores")
      .select("*")
      .eq("entity_type", row.primary_entity_type)
      .eq("entity_id", row.primary_entity_id)
      .maybeSingle(),
  ]);

  return {
    investigation: mapInvestigation(row),
    notes: (notes.data ?? []).map(mapInvestigationNote),
    history: (history.data ?? []).map(mapInvestigationHistory),
    events: (events.data ?? []).map(mapFraudEvent),
    relationships: (rels.data ?? []).map(mapRelationship),
    risk: risk.data ? mapRiskScore(risk.data) : null,
  };
}

export async function markFalsePositive(input: {
  eventId: string;
  actorId: string;
}): Promise<FraudResult<FraudEvent>> {
  if (!isFraudDetectionEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fraud_events")
    .update({
      false_positive: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.eventId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "update_failed" };

  void trackFraudEvent("false_positive", {
    entityType: data.entity_type,
    entityId: data.entity_id,
  });
  void trackFraudEvent("manual_override", {
    entityType: data.entity_type,
    entityId: data.entity_id,
    actorId: input.actorId,
  });

  return { ok: true, data: mapFraudEvent(data) };
}
