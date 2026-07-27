import type {
  QualityCase,
  QualityCaseCategory,
  QualityCasePriority,
  QualityCaseStatus,
  QualityOpenedByRole,
} from "@/lib/quality/types";

type CaseRow = {
  id: string;
  case_number: string;
  category: string;
  status: string;
  priority: string;
  opened_by_role: string;
  opened_by: string | null;
  customer_id: string | null;
  provider_id: string | null;
  booking_id: string | null;
  payment_id: string | null;
  service_request_id: string | null;
  review_id: string | null;
  booking_issue_report_id: string | null;
  title: string;
  description: string;
  resolution_summary: string | null;
  satisfaction_score: number | null;
  assigned_admin_id: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  merged_into_case_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mapQualityCase(row: CaseRow): QualityCase {
  return {
    id: row.id,
    caseNumber: row.case_number,
    category: row.category as QualityCaseCategory,
    status: row.status as QualityCaseStatus,
    priority: row.priority as QualityCasePriority,
    openedByRole: row.opened_by_role as QualityOpenedByRole,
    openedBy: row.opened_by,
    customerId: row.customer_id,
    providerId: row.provider_id,
    bookingId: row.booking_id,
    paymentId: row.payment_id,
    serviceRequestId: row.service_request_id,
    reviewId: row.review_id,
    bookingIssueReportId: row.booking_issue_report_id,
    title: row.title,
    description: row.description,
    resolutionSummary: row.resolution_summary,
    satisfactionScore: row.satisfaction_score,
    assignedAdminId: row.assigned_admin_id,
    escalatedAt: row.escalated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    mergedIntoCaseId: row.merged_into_case_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
