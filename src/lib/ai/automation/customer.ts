/**
 * Customer-facing automations — suggestions & reminders only.
 * Never performs financial actions.
 */

import { getWorkflow } from "./registry";
import { runWorkflow } from "./engine";
import type { AutomationSuggestion, WorkflowRunResult } from "./types";

export type CustomerAutomationContext = {
  userId: string;
  serviceRequestId: string;
  hasPhoto: boolean;
  hasAddress: boolean;
  hoursSinceActivity: number | null;
  status: string;
  hasAppointmentPending?: boolean;
  isCompleted?: boolean;
  hasReview?: boolean;
  categorySlug?: string | null;
};

function toSuggestion(
  run: WorkflowRunResult,
  titles: { en: string; ar: string; bodyEn: string; bodyAr: string },
): AutomationSuggestion {
  return {
    id: run.actionId ?? undefined,
    workflowId: run.workflowId,
    actionType: run.workflowId.split(".").pop() ?? run.workflowId,
    titleEn: titles.en,
    titleAr: titles.ar,
    bodyEn: titles.bodyEn,
    bodyAr: titles.bodyAr,
    confidence: run.confidence,
    decisionMode: run.decisionMode,
    status: run.status,
    reasonEn: run.reasonEn,
    reasonAr: run.reasonAr,
    dataSources: run.dataSources,
    reversible: run.reversible,
    payload: run.result,
  };
}

export async function runCustomerAutomations(
  ctx: CustomerAutomationContext,
): Promise<AutomationSuggestion[]> {
  const out: AutomationSuggestion[] = [];

  if (!ctx.hasPhoto) {
    const wf = getWorkflow("customer.suggest_missing_photos")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "request_incomplete",
      conditions: [
        { key: "missing_photos", satisfied: true, noteEn: "No photos attached" },
      ],
      confidence: 0.92,
      reasonEn: "Photos help providers prepare tools and give accurate quotes.",
      reasonAr: "الصور تساعد المزودين على تجهيز الأدوات وتقديم أسعار أدق.",
      dataSources: ["service_requests.images", "completeness"],
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
      payload: { suggest: "add_photos" },
    });
    out.push(
      toSuggestion(run, {
        en: "Add a photo",
        ar: "أضف صورة",
        bodyEn: run.reasonEn,
        bodyAr: run.reasonAr,
      }),
    );
  }

  if (!ctx.hasAddress) {
    const wf = getWorkflow("customer.suggest_missing_address")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "request_incomplete",
      conditions: [
        {
          key: "missing_address",
          satisfied: true,
          noteEn: "No address / city set",
        },
      ],
      confidence: 0.9,
      reasonEn: "An address helps match nearby providers faster.",
      reasonAr: "العنوان يساعد على مطابقة مزودين قريبين بسرعة أكبر.",
      dataSources: ["service_requests.location_text", "city_id"],
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
      payload: { suggest: "add_address" },
    });
    out.push(
      toSuggestion(run, {
        en: "Add your address",
        ar: "أضف عنوانك",
        bodyEn: run.reasonEn,
        bodyAr: run.reasonAr,
      }),
    );
  }

  if (ctx.hoursSinceActivity != null && ctx.hoursSinceActivity >= 12) {
    const wf = getWorkflow("customer.remind_inactivity")!;
    const conf = ctx.hoursSinceActivity >= 24 ? 0.88 : 0.78;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "customer_inactive",
      conditions: [
        {
          key: "inactive",
          satisfied: true,
          noteEn: `${ctx.hoursSinceActivity.toFixed(1)}h since activity`,
        },
      ],
      confidence: conf,
      reasonEn: "Your request has been quiet — check offers or update details.",
      reasonAr: "طلبك هادئ منذ فترة — راجع العروض أو حدّث التفاصيل.",
      dataSources: ["service_requests.updated_at"],
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
    });
    out.push(
      toSuggestion(run, {
        en: "Still waiting?",
        ar: "ما زلت تنتظر؟",
        bodyEn: run.reasonEn,
        bodyAr: run.reasonAr,
      }),
    );
  }

  if (ctx.hasAppointmentPending) {
    const wf = getWorkflow("customer.suggest_appointment_confirm")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "appointment_pending",
      conditions: [
        {
          key: "appointment_pending",
          satisfied: true,
          noteEn: "Appointment awaiting confirmation",
        },
      ],
      confidence: 0.86,
      reasonEn: "Confirming the appointment locks the slot for both sides.",
      reasonAr: "تأكيد الموعد يحجز الوقت للطرفين.",
      dataSources: ["bookings.status"],
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
    });
    out.push(
      toSuggestion(run, {
        en: "Confirm your appointment",
        ar: "أكد موعدك",
        bodyEn: run.reasonEn,
        bodyAr: run.reasonAr,
      }),
    );
  }

  if (ctx.isCompleted && !ctx.hasReview) {
    const wf = getWorkflow("customer.remind_review")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "job_completed",
      conditions: [
        {
          key: "completed_no_review",
          satisfied: true,
          noteEn: "Completed without review",
        },
      ],
      confidence: 0.91,
      reasonEn: "A short review helps other customers and improves matching.",
      reasonAr: "مراجعة قصيرة تساعد الزبائن الآخرين وتحسّن المطابقة.",
      dataSources: ["service_requests.status", "reviews"],
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
    });
    out.push(
      toSuggestion(run, {
        en: "Leave a review",
        ar: "اترك تقييماً",
        bodyEn: run.reasonEn,
        bodyAr: run.reasonAr,
      }),
    );
  }

  if (ctx.isCompleted && ctx.categorySlug) {
    const wf = getWorkflow("customer.suggest_followup_maintenance")!;
    const { isRecurringServicesEnabled } = await import(
      "@/lib/config/feature-flags"
    );
    if (isRecurringServicesEnabled()) {
      try {
        const { recommendRecurringFromHistory } = await import(
          "@/lib/recurring"
        );
        await recommendRecurringFromHistory({ customerId: ctx.userId });
      } catch {
        /* soft */
      }
    }
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "job_completed",
      conditions: [
        {
          key: "post_job",
          satisfied: true,
          noteEn: "Post-completion maintenance tip",
        },
      ],
      confidence: 0.72,
      reasonEn: `Consider seasonal follow-up maintenance for ${ctx.categorySlug}.`,
      reasonAr: `فكّر بصيانة دورية لاحقة لخدمة ${ctx.categorySlug}.`,
      dataSources: ["categories.slug", "seasonal_priors"],
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
      payload: {
        categorySlug: ctx.categorySlug,
        href: "/account/recurring",
      },
    });
    out.push(
      toSuggestion(run, {
        en: "Follow-up maintenance",
        ar: "صيانة لاحقة",
        bodyEn: run.reasonEn,
        bodyAr: run.reasonAr,
      }),
    );
  }

  return out;
}
