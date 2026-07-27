"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiOpsEnabled } from "@/lib/config/feature-flags";
import {
  acknowledgeAlert,
  buildOpsExportReport,
  completeOpsTask,
  createOpsTask,
  refreshPlatformOps,
  resolveAlert,
} from "@/lib/ai-ops/service";
import { getAiOpsDashboard } from "@/lib/ai-ops/queries";
import { createInvestigation } from "@/lib/fraud/service";
import { createQualityCase } from "@/lib/quality/service";
import { isFraudDetectionEnabled, isQualityCasesEnabled } from "@/lib/config/feature-flags";

export type AiOpsActionState = {
  success: boolean;
  error?: string;
  reportText?: string;
  taskId?: string;
  investigationId?: string;
  caseId?: string;
};

function disabled(): AiOpsActionState {
  return { success: false, error: "feature_disabled" };
}

async function requireOpsAdmin() {
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  return admin;
}

export async function refreshAiOpsAction(): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  const admin = await requireOpsAdmin();
  const result = await refreshPlatformOps({ actorId: admin.id });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  return { success: true };
}

export async function acknowledgeAlertAction(input: {
  alertId: string;
}): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  const admin = await requireOpsAdmin();
  const result = await acknowledgeAlert({
    alertId: input.alertId,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  return { success: true };
}

export async function resolveAlertAction(input: {
  alertId: string;
}): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  const admin = await requireOpsAdmin();
  const result = await resolveAlert({
    alertId: input.alertId,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  return { success: true };
}

export async function createOpsTaskAction(input: {
  title: string;
  body?: string;
  alertId?: string;
  relatedHref?: string;
}): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  const admin = await requireOpsAdmin();
  const result = await createOpsTask({
    title: input.title,
    body: input.body,
    actorId: admin.id,
    alertId: input.alertId,
    relatedHref: input.relatedHref,
    assignToSelf: true,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  return { success: true, taskId: result.data.id };
}

export async function completeOpsTaskAction(input: {
  taskId: string;
}): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  const admin = await requireOpsAdmin();
  const result = await completeOpsTask({
    taskId: input.taskId,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  return { success: true, taskId: result.data.id };
}

export async function exportOpsReportAction(): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  await requireOpsAdmin();
  const dash = await getAiOpsDashboard();
  const reportText = buildOpsExportReport({
    health: dash.health,
    alerts: dash.alerts,
    insights: dash.insights,
    trends: dash.trends,
  });
  return { success: true, reportText };
}

export async function createInvestigationFromOpsAction(input: {
  title: string;
  entityType?: "provider" | "customer";
  entityId?: string;
}): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  if (!isFraudDetectionEnabled()) {
    return { success: false, error: "fraud_disabled" };
  }
  const admin = await requireOpsAdmin();
  const result = await createInvestigation({
    title: input.title,
    primaryEntityType: input.entityType ?? "account",
    primaryEntityId: input.entityId ?? admin.id,
    priority: "high",
    createdBy: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  revalidatePath("/admin/fraud", "layout");
  return { success: true, investigationId: result.data.id };
}

export async function openQualityCaseFromOpsAction(input: {
  title: string;
  description: string;
}): Promise<AiOpsActionState> {
  if (!isAiOpsEnabled()) return disabled();
  if (!isQualityCasesEnabled()) {
    return { success: false, error: "quality_disabled" };
  }
  const admin = await requireOpsAdmin();
  const result = await createQualityCase({
    openedBy: admin.id,
    openedByRole: "admin",
    category: "other",
    title: input.title,
    description: input.description,
    priority: "high",
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/ai-ops", "layout");
  revalidatePath("/admin/quality", "layout");
  return { success: true, caseId: result.data.id };
}
