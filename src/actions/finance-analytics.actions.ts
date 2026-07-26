"use server";

import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isFinanceDashboardEnabled } from "@/lib/config/feature-flags";
import { logAdminAction } from "@/lib/admin/action-log";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  buildFinanceReport,
  computeFinanceDashboardSnapshot,
  financeReportToCsv,
  financeReportToPdf,
  type FinanceDashboardSnapshot,
  type FinancePeriod,
} from "@/lib/finance-analytics";

function gate(): boolean {
  return isFinanceDashboardEnabled();
}

export async function getFinanceDashboardAction(input?: {
  forceRefresh?: boolean;
}): Promise<
  | { ok: true; snapshot: FinanceDashboardSnapshot }
  | { ok: false; error: string }
> {
  if (!gate()) return { ok: false, error: "feature_disabled" };
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const snapshot = await computeFinanceDashboardSnapshot({
    forceRefresh: input?.forceRefresh === true,
    actorUserId: admin.id,
  });

  void emitAiLearningEvent({
    eventType: "finance_dashboard_viewed",
    metadata: { anonymized: true, fromCache: snapshot.fromCache },
  });

  return { ok: true, snapshot };
}

export async function exportFinanceReportCsvAction(
  period: FinancePeriod,
): Promise<
  | { ok: true; filename: string; csv: string }
  | { ok: false; error: string }
> {
  if (!gate()) return { ok: false, error: "feature_disabled" };
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const report = await buildFinanceReport(period);
  const csv = financeReportToCsv(report);
  const filename = `dalily-finance-${period}-${report.generatedAt.slice(0, 10)}.csv`;

  await logAdminAction({
    actorId: admin.id,
    action: "finance_report_exported",
    entityType: "finance_report",
    entityId: period,
    metadata: { format: "csv", period, rows: report.payments.length },
  });
  void emitAiLearningEvent({
    eventType: "finance_report_exported",
    metadata: { anonymized: true, format: "csv", period },
  });

  return { ok: true, filename, csv };
}

export async function exportFinanceReportPdfAction(
  period: FinancePeriod,
): Promise<
  | { ok: true; filename: string; base64: string }
  | { ok: false; error: string }
> {
  if (!gate()) return { ok: false, error: "feature_disabled" };
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const report = await buildFinanceReport(period);
  const pdf = await financeReportToPdf(report);
  const filename = `dalily-finance-${period}-${report.generatedAt.slice(0, 10)}.pdf`;

  await logAdminAction({
    actorId: admin.id,
    action: "finance_report_exported",
    entityType: "finance_report",
    entityId: period,
    metadata: { format: "pdf", period, rows: report.payments.length },
  });
  void emitAiLearningEvent({
    eventType: "finance_report_exported",
    metadata: { anonymized: true, format: "pdf", period },
  });

  return {
    ok: true,
    filename,
    base64: pdf.toString("base64"),
  };
}
