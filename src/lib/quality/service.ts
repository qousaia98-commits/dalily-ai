/**
 * Quality case service — create, transition, evidence, assign, resolve.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { analyzeQualityCase } from "@/lib/quality/ai-analysis";
import { mapQualityCase } from "@/lib/quality/map";
import { trackQualityEvent } from "@/lib/quality/observability";
import { recomputeProviderQualityMetrics } from "@/lib/quality/metrics";
import {
  QUALITY_MEDIA_BUCKET,
  canTransitionQualityStatus,
  type QualityCase,
  type QualityCaseCategory,
  type QualityCaseEvidence,
  type QualityCaseHistoryEntry,
  type QualityCaseMessage,
  type QualityCasePriority,
  type QualityCaseStatus,
  type QualityEvidenceType,
  type QualityOpenedByRole,
  type QualityAiAnalysis,
} from "@/lib/quality/types";
import { isQualityCasesEnabled } from "@/lib/config/feature-flags";
import { SERVICE_REQUEST_MEDIA_BUCKET } from "@/lib/service-requests/constants";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/providers/constants";

export type CreateQualityCaseInput = {
  openedBy: string;
  openedByRole: QualityOpenedByRole;
  category: QualityCaseCategory;
  title: string;
  description: string;
  priority?: QualityCasePriority;
  customerId?: string | null;
  providerId?: string | null;
  bookingId?: string | null;
  paymentId?: string | null;
  serviceRequestId?: string | null;
  reviewId?: string | null;
  bookingIssueReportId?: string | null;
};

export type QualityResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createQualityCase(
  input: CreateQualityCaseInput,
): Promise<QualityResult<QualityCase>> {
  if (!isQualityCasesEnabled()) return { ok: false, error: "feature_disabled" };
  if (!input.title.trim() || input.description.trim().length < 10) {
    return { ok: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const { data: caseNumber, error: numErr } = await admin.rpc(
    "next_quality_case_number",
  );
  const number =
    !numErr && typeof caseNumber === "string"
      ? caseNumber
      : `QC-${Date.now()}`;

  const priorCount = await countPriorCases(
    input.customerId ?? null,
    input.providerId ?? null,
  );

  const { data: row, error } = await admin
    .from("quality_cases")
    .insert({
      case_number: number,
      category: input.category,
      status: "open",
      priority: input.priority ?? "medium",
      opened_by_role: input.openedByRole,
      opened_by: input.openedBy,
      customer_id: input.customerId ?? (input.openedByRole === "customer" ? input.openedBy : null),
      provider_id: input.providerId ?? null,
      booking_id: input.bookingId ?? null,
      payment_id: input.paymentId ?? null,
      service_request_id: input.serviceRequestId ?? null,
      review_id: input.reviewId ?? null,
      booking_issue_report_id: input.bookingIssueReportId ?? null,
      title: input.title.trim().slice(0, 200),
      description: input.description.trim().slice(0, 5000),
    })
    .select("*")
    .single();

  if (error || !row) return { ok: false, error: "create_failed" };

  await appendHistory({
    caseId: row.id,
    fromStatus: null,
    toStatus: "open",
    action: "created",
    actorId: input.openedBy,
    actorRole: input.openedByRole,
    note: "Case opened",
  });

  const analysis = analyzeQualityCase({
    caseId: row.id,
    title: row.title,
    description: row.description,
    category: input.category,
    priorCaseCountForPair: priorCount,
  });

  await admin.from("quality_case_ai_analysis").upsert({
    case_id: row.id,
    sentiment: analysis.sentiment,
    severity: analysis.severity,
    urgency: analysis.urgency,
    risk_level: analysis.riskLevel,
    suggested_category: analysis.suggestedCategory,
    suggested_priority: analysis.suggestedPriority,
    suggested_resolution: analysis.suggestedResolution,
    repeated_pattern: analysis.repeatedPattern,
    pattern_notes: analysis.patternNotes,
    topics: analysis.topics,
    model_version: analysis.modelVersion,
    analyzed_at: new Date().toISOString(),
    raw: analysis,
  });

  // Apply AI suggestions when priority was default
  if (!input.priority && analysis.suggestedPriority) {
    await admin
      .from("quality_cases")
      .update({
        priority: analysis.suggestedPriority,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    row.priority = analysis.suggestedPriority;
  }

  if (analysis.riskLevel === "critical" || analysis.riskLevel === "high") {
    await transitionQualityStatus({
      caseId: row.id,
      toStatus: analysis.riskLevel === "critical" ? "escalated" : "under_review",
      actorId: input.openedBy,
      actorRole: "system",
      note: `Auto-routed by AI (${analysis.riskLevel} risk)`,
    });
  }

  if (input.providerId) {
    void recomputeProviderQualityMetrics(input.providerId);
  }

  void trackQualityEvent("case_created", {
    caseId: row.id,
    providerId: input.providerId,
    category: input.category,
  });
  void trackQualityEvent("ai_analysis_completed", {
    caseId: row.id,
    providerId: input.providerId,
    riskLevel: analysis.riskLevel,
  });

  return { ok: true, data: mapQualityCase(row) };
}

export async function transitionQualityStatus(input: {
  caseId: string;
  toStatus: QualityCaseStatus;
  actorId: string;
  actorRole: QualityOpenedByRole;
  note?: string;
  resolutionSummary?: string;
}): Promise<QualityResult<QualityCase>> {
  if (!isQualityCasesEnabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("quality_cases")
    .select("*")
    .eq("id", input.caseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!current) return { ok: false, error: "not_found" };

  const from = current.status as QualityCaseStatus;
  if (!canTransitionQualityStatus(from, input.toStatus)) {
    return { ok: false, error: "invalid_transition" };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: now,
  };
  if (input.toStatus === "escalated") patch.escalated_at = now;
  if (input.toStatus === "resolved") {
    patch.resolved_at = now;
    if (input.resolutionSummary) {
      patch.resolution_summary = input.resolutionSummary.trim();
    }
  }
  if (input.toStatus === "closed") patch.closed_at = now;
  if (input.toStatus === "rejected" && input.resolutionSummary) {
    patch.resolution_summary = input.resolutionSummary.trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (admin as any)
    .from("quality_cases")
    .update(patch)
    .eq("id", input.caseId)
    .select("*")
    .single();

  if (error || !updated) return { ok: false, error: "update_failed" };

  const action =
    input.toStatus === "escalated"
      ? "escalated"
      : input.toStatus === "resolved"
        ? "resolved"
        : input.toStatus === "rejected"
          ? "rejected"
          : input.toStatus === "closed"
            ? "closed"
            : "status_changed";

  await appendHistory({
    caseId: input.caseId,
    fromStatus: from,
    toStatus: input.toStatus,
    action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    note: input.note ?? null,
  });

  if (updated.provider_id) {
    void recomputeProviderQualityMetrics(updated.provider_id);
  }

  void trackQualityEvent(
    input.toStatus === "escalated"
      ? "case_escalated"
      : input.toStatus === "resolved"
        ? "case_resolved"
        : "status_changed",
    {
      caseId: input.caseId,
      providerId: updated.provider_id,
      from,
      to: input.toStatus,
    },
  );

  return { ok: true, data: mapQualityCase(updated) };
}

export async function assignQualityCase(input: {
  caseId: string;
  adminId: string;
  assignedBy: string;
  note?: string;
}): Promise<QualityResult<QualityCase>> {
  if (!isQualityCasesEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  await admin
    .from("quality_case_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("case_id", input.caseId)
    .is("unassigned_at", null);

  await admin.from("quality_case_assignments").insert({
    case_id: input.caseId,
    admin_id: input.adminId,
    assigned_by: input.assignedBy,
    note: input.note ?? null,
  });

  const { data: updated, error } = await admin
    .from("quality_cases")
    .update({
      assigned_admin_id: input.adminId,
      updated_at: new Date().toISOString(),
      status: "under_review",
    })
    .eq("id", input.caseId)
    .select("*")
    .single();

  if (error || !updated) return { ok: false, error: "update_failed" };

  await appendHistory({
    caseId: input.caseId,
    fromStatus: null,
    toStatus: updated.status,
    action: "assigned",
    actorId: input.assignedBy,
    actorRole: "admin",
    note: input.note ?? `Assigned to ${input.adminId}`,
  });

  void trackQualityEvent("case_assigned", {
    caseId: input.caseId,
    providerId: updated.provider_id,
    adminId: input.adminId,
  });

  return { ok: true, data: mapQualityCase(updated) };
}

export async function addQualityCaseMessage(input: {
  caseId: string;
  authorId: string;
  authorRole: QualityOpenedByRole;
  body: string;
  visibility?: "shared" | "internal";
}): Promise<QualityResult<QualityCaseMessage>> {
  if (!isQualityCasesEnabled()) return { ok: false, error: "feature_disabled" };
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) {
    return { ok: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const visibility =
    input.authorRole === "admin" ? (input.visibility ?? "shared") : "shared";

  const { data, error } = await admin
    .from("quality_case_messages")
    .insert({
      case_id: input.caseId,
      author_id: input.authorId,
      author_role: input.authorRole,
      visibility,
      body,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };

  if (visibility === "internal") {
    await appendHistory({
      caseId: input.caseId,
      fromStatus: null,
      toStatus: null,
      action: "note_added",
      actorId: input.authorId,
      actorRole: input.authorRole,
      note: body.slice(0, 200),
    });
  }

  return {
    ok: true,
    data: {
      id: data.id,
      caseId: data.case_id,
      authorId: data.author_id,
      authorRole: data.author_role as QualityOpenedByRole,
      visibility: data.visibility as "shared" | "internal",
      body: data.body,
      createdAt: data.created_at,
    },
  };
}

export async function uploadQualityEvidence(input: {
  caseId: string;
  uploadedBy: string;
  evidenceType: QualityEvidenceType;
  file?: File;
  referenceId?: string | null;
  referenceLabel?: string | null;
}): Promise<QualityResult<QualityCaseEvidence>> {
  if (!isQualityCasesEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();

  let path: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;
  const bucket = QUALITY_MEDIA_BUCKET;

  if (input.file && input.file.size > 0) {
    if (input.file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "file_too_large" };
    }
    if (
      input.evidenceType === "photo" &&
      !ALLOWED_IMAGE_TYPES.includes(
        input.file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      )
    ) {
      return { ok: false, error: "invalid_file_type" };
    }

    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    path = `quality-cases/${input.caseId}/${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .upload(path, buffer, { contentType: input.file.type, upsert: false });
    if (uploadError) return { ok: false, error: "upload_failed" };
    mimeType = input.file.type;
    sizeBytes = input.file.size;
  }

  const { data, error } = await admin
    .from("quality_case_evidence")
    .insert({
      case_id: input.caseId,
      evidence_type: input.evidenceType,
      uploaded_by: input.uploadedBy,
      bucket,
      path,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      reference_id: input.referenceId ?? null,
      reference_label: input.referenceLabel ?? null,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };

  void trackQualityEvent("evidence_uploaded", {
    caseId: input.caseId,
    evidenceType: input.evidenceType,
  });

  return {
    ok: true,
    data: {
      id: data.id,
      caseId: data.case_id,
      evidenceType: data.evidence_type as QualityEvidenceType,
      uploadedBy: data.uploaded_by,
      bucket: data.bucket,
      path: data.path,
      mimeType: data.mime_type,
      sizeBytes: data.size_bytes,
      referenceId: data.reference_id,
      referenceLabel: data.reference_label,
      createdAt: data.created_at,
    },
  };
}

export async function mergeQualityCases(input: {
  sourceCaseId: string;
  targetCaseId: string;
  actorId: string;
}): Promise<QualityResult<QualityCase>> {
  if (!isQualityCasesEnabled()) return { ok: false, error: "feature_disabled" };
  if (input.sourceCaseId === input.targetCaseId) {
    return { ok: false, error: "validation_error" };
  }
  const admin = createAdminClient();

  const { data: source } = await admin
    .from("quality_cases")
    .select("*")
    .eq("id", input.sourceCaseId)
    .maybeSingle();
  const { data: target } = await admin
    .from("quality_cases")
    .select("*")
    .eq("id", input.targetCaseId)
    .maybeSingle();

  if (!source || !target) return { ok: false, error: "not_found" };

  await admin
    .from("quality_cases")
    .update({
      merged_into_case_id: input.targetCaseId,
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sourceCaseId);

  await appendHistory({
    caseId: input.sourceCaseId,
    fromStatus: source.status,
    toStatus: "closed",
    action: "merged",
    actorId: input.actorId,
    actorRole: "admin",
    note: `Merged into ${target.case_number}`,
  });
  await appendHistory({
    caseId: input.targetCaseId,
    fromStatus: target.status,
    toStatus: target.status,
    action: "merged",
    actorId: input.actorId,
    actorRole: "admin",
    note: `Absorbed case ${source.case_number}`,
  });

  return { ok: true, data: mapQualityCase(target) };
}

export async function getQualityCaseDetail(caseId: string): Promise<{
  case: QualityCase;
  messages: QualityCaseMessage[];
  evidence: QualityCaseEvidence[];
  history: QualityCaseHistoryEntry[];
  ai: QualityAiAnalysis | null;
} | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("quality_cases")
    .select("*")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;

  const [messages, evidence, history, ai] = await Promise.all([
    admin
      .from("quality_case_messages")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("quality_case_evidence")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("quality_case_history")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("quality_case_ai_analysis")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle(),
  ]);

  const evidenceRows = evidence.data ?? [];
  const signed = await signEvidencePaths(
    evidenceRows
      .map((e) => e.path)
      .filter((p): p is string => Boolean(p)),
  );

  return {
    case: mapQualityCase(row),
    messages: (messages.data ?? []).map((m) => ({
      id: m.id,
      caseId: m.case_id,
      authorId: m.author_id,
      authorRole: m.author_role as QualityOpenedByRole,
      visibility: m.visibility as "shared" | "internal",
      body: m.body,
      createdAt: m.created_at,
    })),
    evidence: evidenceRows.map((e) => ({
      id: e.id,
      caseId: e.case_id,
      evidenceType: e.evidence_type as QualityEvidenceType,
      uploadedBy: e.uploaded_by,
      bucket: e.bucket,
      path: e.path,
      mimeType: e.mime_type,
      sizeBytes: e.size_bytes,
      referenceId: e.reference_id,
      referenceLabel: e.reference_label,
      signedUrl: e.path ? signed.get(e.path) ?? null : null,
      createdAt: e.created_at,
    })),
    history: (history.data ?? []).map((h) => ({
      id: h.id,
      caseId: h.case_id,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      action: h.action,
      actorId: h.actor_id,
      actorRole: h.actor_role,
      note: h.note,
      createdAt: h.created_at,
    })),
    ai: ai.data
      ? {
          caseId: ai.data.case_id,
          sentiment: ai.data.sentiment as QualityAiAnalysis["sentiment"],
          severity: Number(ai.data.severity),
          urgency: Number(ai.data.urgency),
          riskLevel: ai.data.risk_level as QualityAiAnalysis["riskLevel"],
          suggestedCategory: ai.data.suggested_category,
          suggestedPriority: ai.data.suggested_priority,
          suggestedResolution: ai.data.suggested_resolution,
          repeatedPattern: ai.data.repeated_pattern,
          patternNotes: ai.data.pattern_notes,
          topics: (ai.data.topics as string[]) ?? [],
          modelVersion: ai.data.model_version,
          analyzedAt: ai.data.analyzed_at,
        }
      : null,
  };
}

async function appendHistory(input: {
  caseId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  note: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("quality_case_history").insert({
    case_id: input.caseId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    action: input.action,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    note: input.note,
  });
}

async function countPriorCases(
  customerId: string | null,
  providerId: string | null,
): Promise<number> {
  if (!customerId || !providerId) return 0;
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("quality_cases")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("provider_id", providerId)
      .is("deleted_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function signEvidencePaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
  } catch {
    /* soft */
  }
  return map;
}

/** Bridge booking issue reports into quality cases (idempotent). */
export async function createCaseFromBookingIssue(input: {
  bookingIssueReportId: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  reason: string;
  details: string | null;
}): Promise<QualityResult<QualityCase>> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("quality_cases")
    .select("*")
    .eq("booking_issue_report_id", input.bookingIssueReportId)
    .maybeSingle();
  if (existing) return { ok: true, data: mapQualityCase(existing) };

  const category = mapBookingIssueReason(input.reason);
  return createQualityCase({
    openedBy: input.customerId,
    openedByRole: "customer",
    category,
    title: `Booking issue: ${input.reason.replace(/_/g, " ")}`,
    description: input.details?.trim() || `Customer reported: ${input.reason}`,
    customerId: input.customerId,
    providerId: input.providerId,
    bookingId: input.bookingId,
    bookingIssueReportId: input.bookingIssueReportId,
  });
}

function mapBookingIssueReason(reason: string): QualityCaseCategory {
  switch (reason) {
    case "provider_never_arrived":
      return "no_show";
    case "poor_quality":
    case "work_incomplete":
      return "service_quality";
    case "provider_cancelled":
      return "booking_issue";
    default:
      return "booking_issue";
  }
}
