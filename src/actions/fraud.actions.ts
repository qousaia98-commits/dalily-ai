"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isFraudDetectionEnabled } from "@/lib/config/feature-flags";
import {
  INVESTIGATION_STATUSES,
  RISK_ENTITY_TYPES,
  type InvestigationStatus,
  type RiskEntityType,
} from "@/lib/fraud/types";
import {
  addInvestigationNote,
  assignInvestigation,
  createInvestigation,
  markFalsePositive,
  mergeInvestigations,
  recalculateEntityRisk,
  transitionInvestigation,
  confirmEntityRelationship,
} from "@/lib/fraud/service";

export type FraudActionState = {
  success: boolean;
  error?: string;
  investigationId?: string;
};

function disabled(): FraudActionState {
  return { success: false, error: "feature_disabled" };
}

async function requireFraudAdmin() {
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  return admin;
}

export async function recalculateRiskAction(input: {
  entityType: RiskEntityType;
  entityId: string;
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  if (!RISK_ENTITY_TYPES.includes(input.entityType)) {
    return { success: false, error: "validation_error" };
  }
  const result = await recalculateEntityRisk({
    ...input,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true };
}

export async function createInvestigationAction(input: {
  title: string;
  entityType: RiskEntityType;
  entityId: string;
  priority?: "low" | "medium" | "high" | "urgent";
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  const result = await createInvestigation({
    title: input.title,
    primaryEntityType: input.entityType,
    primaryEntityId: input.entityId,
    priority: input.priority ?? "medium",
    createdBy: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true, investigationId: result.data.id };
}

export async function transitionInvestigationAction(input: {
  investigationId: string;
  toStatus: InvestigationStatus;
  note?: string;
  outcome?: string;
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  if (!INVESTIGATION_STATUSES.includes(input.toStatus)) {
    return { success: false, error: "validation_error" };
  }
  const result = await transitionInvestigation({
    ...input,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true, investigationId: result.data.id };
}

export async function assignInvestigationAction(input: {
  investigationId: string;
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  const result = await assignInvestigation({
    investigationId: input.investigationId,
    adminId: admin.id,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true, investigationId: result.data.id };
}

export async function addInvestigationNoteAction(
  _prev: FraudActionState,
  formData: FormData,
): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  const result = await addInvestigationNote({
    investigationId: String(formData.get("investigationId") ?? ""),
    authorId: admin.id,
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true, investigationId: result.data.investigationId };
}

export async function mergeInvestigationsAction(input: {
  sourceId: string;
  targetId: string;
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  const result = await mergeInvestigations({
    ...input,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true, investigationId: result.data.id };
}

export async function markFalsePositiveAction(input: {
  eventId: string;
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  const admin = await requireFraudAdmin();
  const result = await markFalsePositive({
    eventId: input.eventId,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true };
}

export async function confirmRelationshipAction(input: {
  fromEntityType: RiskEntityType;
  fromEntityId: string;
  toEntityType: RiskEntityType;
  toEntityId: string;
  relationshipType:
    | "same_owner"
    | "shared_booking"
    | "duplicate_candidate"
    | "investigation_link"
    | "other";
}): Promise<FraudActionState> {
  if (!isFraudDetectionEnabled()) return disabled();
  await requireFraudAdmin();
  const result = await confirmEntityRelationship(input);
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/fraud", "layout");
  return { success: true };
}

export async function listEntityRelationshipsAction(input: {
  entityType: RiskEntityType;
  entityId: string;
}): Promise<{
  relationships: Array<{
    id: string;
    fromEntityType: string;
    fromEntityId: string;
    toEntityType: string;
    toEntityId: string;
    relationshipType: string;
    confidence: number;
  }>;
}> {
  if (!isFraudDetectionEnabled()) return { relationships: [] };
  try {
    await requireFraudAdmin();
  } catch {
    return { relationships: [] };
  }
  const { listConfirmedRelationships } = await import("@/lib/fraud/queries");
  const { mapRelationship } = await import("@/lib/fraud/map");
  const rows = await listConfirmedRelationships(input.entityType, input.entityId);
  return {
    relationships: rows.map((r) => {
      const m = mapRelationship(r);
      return {
        id: m.id,
        fromEntityType: m.fromEntityType,
        fromEntityId: m.fromEntityId,
        toEntityType: m.toEntityType,
        toEntityId: m.toEntityId,
        relationshipType: m.relationshipType,
        confidence: m.confidence,
      };
    }),
  };
}
