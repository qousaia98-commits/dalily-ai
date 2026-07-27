/** Row mappers for fraud domain */

import type {
  EntityRelationship,
  FraudEvent,
  Investigation,
  InvestigationHistoryEntry,
  InvestigationNote,
  RiskEntityType,
  RiskLevel,
  RiskScore,
  RelationshipType,
  FraudEventType,
  InvestigationStatus,
} from "@/lib/fraud/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFraudEvent(row: any): FraudEvent {
  return {
    id: row.id,
    eventType: row.event_type as FraudEventType,
    entityType: row.entity_type as RiskEntityType,
    entityId: row.entity_id,
    severity: row.severity as RiskLevel,
    confidence: Number(row.confidence),
    ruleKey: row.rule_key,
    title: row.title,
    summary: row.summary,
    relatedEntityIds: (row.related_entity_ids as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    source: row.source,
    investigationId: row.investigation_id,
    resolvedAt: row.resolved_at,
    falsePositive: Boolean(row.false_positive),
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRiskScore(row: any): RiskScore {
  return {
    entityType: row.entity_type as RiskEntityType,
    entityId: row.entity_id,
    internalScore: Number(row.internal_score),
    riskLevel: row.risk_level as RiskLevel,
    confidence: Number(row.confidence),
    explanation: row.explanation,
    triggeredRules: (row.triggered_rules as string[]) ?? [],
    suggestedAction: row.suggested_action,
    relatedEvents: (row.related_events as string[]) ?? [],
    duplicateCandidates: (row.duplicate_candidates as string[]) ?? [],
    signalBreakdown: (row.signal_breakdown as Record<string, number>) ?? {},
    modelVersion: row.model_version,
    mlContribution: Number(row.ml_contribution ?? 0),
    computedAt: row.computed_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapInvestigation(row: any): Investigation {
  return {
    id: row.id,
    caseNumber: row.case_number,
    title: row.title,
    status: row.status as InvestigationStatus,
    priority: row.priority,
    primaryEntityType: row.primary_entity_type as RiskEntityType,
    primaryEntityId: row.primary_entity_id,
    relatedEntityIds: (row.related_entity_ids as string[]) ?? [],
    assignedAdminId: row.assigned_admin_id,
    outcome: row.outcome,
    mergedIntoId: row.merged_into_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapInvestigationNote(row: any): InvestigationNote {
  return {
    id: row.id,
    investigationId: row.investigation_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapInvestigationHistory(row: any): InvestigationHistoryEntry {
  return {
    id: row.id,
    investigationId: row.investigation_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    action: row.action,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRelationship(row: any): EntityRelationship {
  return {
    id: row.id,
    fromEntityType: row.from_entity_type as RiskEntityType,
    fromEntityId: row.from_entity_id,
    toEntityType: row.to_entity_type as RiskEntityType,
    toEntityId: row.to_entity_id,
    relationshipType: row.relationship_type as RelationshipType,
    confirmed: Boolean(row.confirmed),
    confidence: Number(row.confidence),
    evidence: (row.evidence as Record<string, unknown>) ?? {},
  };
}
