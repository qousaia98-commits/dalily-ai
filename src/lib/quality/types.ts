/** Sprint 7 Phase 4 — Quality Assurance & Case Management types */

export const QUALITY_CASE_CATEGORIES = [
  "customer_complaint",
  "provider_complaint",
  "booking_issue",
  "service_quality",
  "communication",
  "damage_report",
  "late_arrival",
  "no_show",
  "policy_violation",
  "other",
] as const;

export type QualityCaseCategory = (typeof QUALITY_CASE_CATEGORIES)[number];

export const QUALITY_CASE_STATUSES = [
  "open",
  "pending_information",
  "under_review",
  "waiting_for_provider",
  "waiting_for_customer",
  "resolved",
  "rejected",
  "escalated",
  "closed",
] as const;

export type QualityCaseStatus = (typeof QUALITY_CASE_STATUSES)[number];

export const QUALITY_CASE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type QualityCasePriority = (typeof QUALITY_CASE_PRIORITIES)[number];

export type QualityOpenedByRole = "customer" | "provider" | "admin" | "system";

export type QualityEvidenceType =
  | "photo"
  | "video"
  | "document"
  | "chat_reference"
  | "booking_history"
  | "payment_reference"
  | "review_reference"
  | "other";

export type QualityCase = {
  id: string;
  caseNumber: string;
  category: QualityCaseCategory;
  status: QualityCaseStatus;
  priority: QualityCasePriority;
  openedByRole: QualityOpenedByRole;
  openedBy: string | null;
  customerId: string | null;
  providerId: string | null;
  bookingId: string | null;
  paymentId: string | null;
  serviceRequestId: string | null;
  reviewId: string | null;
  bookingIssueReportId: string | null;
  title: string;
  description: string;
  resolutionSummary: string | null;
  satisfactionScore: number | null;
  assignedAdminId: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  mergedIntoCaseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QualityCaseMessage = {
  id: string;
  caseId: string;
  authorId: string | null;
  authorRole: QualityOpenedByRole;
  visibility: "shared" | "internal";
  body: string;
  createdAt: string;
};

export type QualityCaseEvidence = {
  id: string;
  caseId: string;
  evidenceType: QualityEvidenceType;
  uploadedBy: string | null;
  bucket: string;
  path: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  referenceId: string | null;
  referenceLabel: string | null;
  signedUrl?: string | null;
  createdAt: string;
};

export type QualityCaseHistoryEntry = {
  id: string;
  caseId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: string;
};

export type QualityAiAnalysis = {
  caseId: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
  severity: number;
  urgency: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  suggestedCategory: string | null;
  suggestedPriority: string | null;
  suggestedResolution: string | null;
  repeatedPattern: boolean;
  patternNotes: string | null;
  topics: string[];
  modelVersion: string;
  analyzedAt: string;
};

export type ProviderQualityInsights = {
  providerId: string;
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  resolutionRate: number | null;
  avgResolutionHours: number | null;
  complaintRate: number | null;
  repeatComplaintCount: number;
  avgSatisfaction: number | null;
  categoryBreakdown: Record<string, number>;
  recommendations: string[];
  recentCases: Array<{
    id: string;
    caseNumber: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
};

/** Allowed status transitions — immutable history records every change. */
export const QUALITY_STATUS_TRANSITIONS: Record<
  QualityCaseStatus,
  QualityCaseStatus[]
> = {
  open: [
    "pending_information",
    "under_review",
    "waiting_for_provider",
    "waiting_for_customer",
    "escalated",
    "resolved",
    "rejected",
    "closed",
  ],
  pending_information: [
    "open",
    "under_review",
    "waiting_for_provider",
    "waiting_for_customer",
    "escalated",
    "closed",
  ],
  under_review: [
    "pending_information",
    "waiting_for_provider",
    "waiting_for_customer",
    "escalated",
    "resolved",
    "rejected",
    "closed",
  ],
  waiting_for_provider: [
    "under_review",
    "pending_information",
    "waiting_for_customer",
    "escalated",
    "resolved",
    "closed",
  ],
  waiting_for_customer: [
    "under_review",
    "pending_information",
    "waiting_for_provider",
    "escalated",
    "resolved",
    "closed",
  ],
  escalated: ["under_review", "resolved", "rejected", "closed"],
  resolved: ["closed", "under_review"],
  rejected: ["closed", "under_review"],
  closed: ["under_review"],
};

export function canTransitionQualityStatus(
  from: QualityCaseStatus,
  to: QualityCaseStatus,
): boolean {
  if (from === to) return false;
  return QUALITY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const QUALITY_MEDIA_BUCKET = "service-request-media";
export const QUALITY_MODEL_VERSION = "quality-heuristic-v1";
