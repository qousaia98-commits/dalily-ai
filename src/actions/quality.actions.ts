"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { getOwnedProvider } from "@/lib/providers/database";
import { isQualityCasesEnabled } from "@/lib/config/feature-flags";
import {
  QUALITY_CASE_CATEGORIES,
  QUALITY_CASE_STATUSES,
  type QualityCaseCategory,
  type QualityCasePriority,
  type QualityCaseStatus,
} from "@/lib/quality/types";
import {
  createQualityCase,
  transitionQualityStatus,
  assignQualityCase,
  addQualityCaseMessage,
  uploadQualityEvidence,
  mergeQualityCases,
} from "@/lib/quality/service";

export type QualityActionState = {
  success: boolean;
  error?: string;
  caseId?: string;
  caseNumber?: string;
};

function disabled(): QualityActionState {
  return { success: false, error: "feature_disabled" };
}

export async function createQualityCaseAction(
  _prev: QualityActionState,
  formData: FormData,
): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const category = String(formData.get("category") ?? "") as QualityCaseCategory;
  if (!QUALITY_CASE_CATEGORIES.includes(category)) {
    return { success: false, error: "validation_error" };
  }

  const roleRaw = String(formData.get("role") ?? "customer");
  let openedByRole: "customer" | "provider" | "admin" = "customer";
  let providerId = String(formData.get("providerId") ?? "") || null;

  if (roleRaw === "provider") {
    const owned = await getOwnedProvider(authUser.id);
    if (!owned) return { success: false, error: "forbidden" };
    openedByRole = "provider";
    providerId = owned.id;
  } else if (roleRaw === "admin") {
    const admin = await requireAdminUser();
    if (!isAdminUser(admin.roles)) return { success: false, error: "forbidden" };
    openedByRole = "admin";
  }

  const result = await createQualityCase({
    openedBy: authUser.id,
    openedByRole,
    category,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: (String(formData.get("priority") ?? "medium") ||
      "medium") as QualityCasePriority,
    customerId:
      openedByRole === "customer"
        ? authUser.id
        : String(formData.get("customerId") ?? "") || null,
    providerId,
    bookingId: String(formData.get("bookingId") ?? "") || null,
    paymentId: String(formData.get("paymentId") ?? "") || null,
    serviceRequestId: String(formData.get("serviceRequestId") ?? "") || null,
    reviewId: String(formData.get("reviewId") ?? "") || null,
  });

  if (!result.ok) return { success: false, error: result.error };

  const photo = formData.get("evidence");
  if (photo instanceof File && photo.size > 0) {
    await uploadQualityEvidence({
      caseId: result.data.id,
      uploadedBy: authUser.id,
      evidenceType: "photo",
      file: photo,
    });
  }

  revalidatePath("/account/quality", "layout");
  revalidatePath("/business/quality", "layout");
  revalidatePath("/admin/quality", "layout");
  return {
    success: true,
    caseId: result.data.id,
    caseNumber: result.data.caseNumber,
  };
}

export async function transitionQualityCaseAction(input: {
  caseId: string;
  toStatus: QualityCaseStatus;
  note?: string;
  resolutionSummary?: string;
}): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) return { success: false, error: "forbidden" };
  if (!QUALITY_CASE_STATUSES.includes(input.toStatus)) {
    return { success: false, error: "validation_error" };
  }

  const result = await transitionQualityStatus({
    caseId: input.caseId,
    toStatus: input.toStatus,
    actorId: admin.id,
    actorRole: "admin",
    note: input.note,
    resolutionSummary: input.resolutionSummary,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/quality", "layout");
  return { success: true, caseId: result.data.id };
}

export async function assignQualityCaseAction(input: {
  caseId: string;
  adminId?: string;
  note?: string;
}): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) return { success: false, error: "forbidden" };

  const result = await assignQualityCase({
    caseId: input.caseId,
    adminId: input.adminId || admin.id,
    assignedBy: admin.id,
    note: input.note,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/quality", "layout");
  return { success: true, caseId: result.data.id };
}

export async function addQualityCaseMessageAction(
  _prev: QualityActionState,
  formData: FormData,
): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const caseId = String(formData.get("caseId") ?? "");
  const body = String(formData.get("body") ?? "");
  const visibility = String(formData.get("visibility") ?? "shared") as
    | "shared"
    | "internal";
  const roleRaw = String(formData.get("role") ?? "customer");

  let authorRole: "customer" | "provider" | "admin" = "customer";
  if (roleRaw === "admin") {
    const admin = await requireAdminUser();
    if (!isAdminUser(admin.roles)) return { success: false, error: "forbidden" };
    authorRole = "admin";
  } else if (roleRaw === "provider") {
    const owned = await getOwnedProvider(authUser.id);
    if (!owned) return { success: false, error: "forbidden" };
    authorRole = "provider";
  }

  const result = await addQualityCaseMessage({
    caseId,
    authorId: authUser.id,
    authorRole,
    body,
    visibility: authorRole === "admin" ? visibility : "shared",
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/quality", "layout");
  revalidatePath("/account/quality", "layout");
  revalidatePath("/business/quality", "layout");
  return { success: true, caseId };
}

export async function uploadQualityEvidenceAction(
  _prev: QualityActionState,
  formData: FormData,
): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const caseId = String(formData.get("caseId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "validation_error" };
  }

  const result = await uploadQualityEvidence({
    caseId,
    uploadedBy: authUser.id,
    evidenceType: "photo",
    file,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/quality", "layout");
  revalidatePath("/account/quality", "layout");
  return { success: true, caseId };
}

export async function mergeQualityCasesAction(input: {
  sourceCaseId: string;
  targetCaseId: string;
}): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) return { success: false, error: "forbidden" };

  const result = await mergeQualityCases({
    ...input,
    actorId: admin.id,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/quality", "layout");
  return { success: true, caseId: result.data.id };
}

export async function setCaseSatisfactionAction(input: {
  caseId: string;
  score: number;
}): Promise<QualityActionState> {
  if (!isQualityCasesEnabled()) return disabled();
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return { success: false, error: "validation_error" };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("quality_cases")
    .select("id, customer_id, provider_id, status")
    .eq("id", input.caseId)
    .eq("customer_id", authUser.id)
    .maybeSingle();

  if (!row) return { success: false, error: "not_found" };
  if (row.status !== "resolved" && row.status !== "closed") {
    return { success: false, error: "invalid_status" };
  }

  await admin
    .from("quality_cases")
    .update({
      satisfaction_score: input.score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.caseId);

  if (row.provider_id) {
    const { recomputeProviderQualityMetrics } = await import(
      "@/lib/quality/metrics"
    );
    void recomputeProviderQualityMetrics(row.provider_id);
  }

  return { success: true, caseId: input.caseId };
}
