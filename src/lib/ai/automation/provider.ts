/**
 * Provider-facing automations.
 * Auto-accept only when provider explicitly opts in.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkflow } from "./registry";
import { runWorkflow } from "./engine";
import type {
  AutomationSuggestion,
  ProviderAutomationSettings,
  WorkflowRunResult,
} from "./types";

const DEFAULT_SETTINGS: Omit<ProviderAutomationSettings, "providerId"> = {
  autoAcceptEnabled: false,
  autoRejectOutOfArea: true,
  autoRejectOutsideHours: true,
  suggestRouteOptimization: true,
  suggestScheduleGaps: true,
  minAutoAcceptConfidence: 0.95,
};

export async function getProviderAutomationSettings(
  providerId: string,
): Promise<ProviderAutomationSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_provider_automation_settings")
      .select("*")
      .eq("provider_id", providerId)
      .maybeSingle();

    if (!data) {
      return { providerId, ...DEFAULT_SETTINGS };
    }

    return {
      providerId,
      autoAcceptEnabled: Boolean(data.auto_accept_enabled),
      autoRejectOutOfArea: data.auto_reject_out_of_area !== false,
      autoRejectOutsideHours: data.auto_reject_outside_hours !== false,
      suggestRouteOptimization: data.suggest_route_optimization !== false,
      suggestScheduleGaps: data.suggest_schedule_gaps !== false,
      minAutoAcceptConfidence: Number(
        data.min_auto_accept_confidence ?? 0.95,
      ),
    };
  } catch {
    return { providerId, ...DEFAULT_SETTINGS };
  }
}

export async function upsertProviderAutomationSettings(
  settings: ProviderAutomationSettings,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_provider_automation_settings").upsert({
      provider_id: settings.providerId,
      auto_accept_enabled: settings.autoAcceptEnabled,
      auto_reject_out_of_area: settings.autoRejectOutOfArea,
      auto_reject_outside_hours: settings.autoRejectOutsideHours,
      suggest_route_optimization: settings.suggestRouteOptimization,
      suggest_schedule_gaps: settings.suggestScheduleGaps,
      min_auto_accept_confidence: settings.minAutoAcceptConfidence,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

function toSuggestion(
  run: WorkflowRunResult,
  titles: { en: string; ar: string },
): AutomationSuggestion {
  return {
    id: run.actionId ?? undefined,
    workflowId: run.workflowId,
    actionType: run.workflowId.split(".").pop() ?? run.workflowId,
    titleEn: titles.en,
    titleAr: titles.ar,
    bodyEn: run.reasonEn,
    bodyAr: run.reasonAr,
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

export type ProviderAutomationContext = {
  providerId: string;
  userId?: string | null;
  freeHoursToday?: number | null;
  bookingsToday?: number;
  nearbyOpenRequests?: number;
  overloaded?: boolean;
  outOfAreaCandidate?: boolean;
  outsideHoursCandidate?: boolean;
  serviceRequestId?: string | null;
  /** When true and settings allow, may auto-accept at high confidence */
  canAutoAcceptCandidate?: boolean;
  autoAcceptConfidence?: number;
};

export async function runProviderAutomations(
  ctx: ProviderAutomationContext,
): Promise<AutomationSuggestion[]> {
  const settings = await getProviderAutomationSettings(ctx.providerId);
  const out: AutomationSuggestion[] = [];

  if (
    settings.autoAcceptEnabled &&
    ctx.canAutoAcceptCandidate &&
    (ctx.autoAcceptConfidence ?? 0) >= settings.minAutoAcceptConfidence
  ) {
    const wf = getWorkflow("provider.auto_accept_job")!;
    const conf = ctx.autoAcceptConfidence ?? settings.minAutoAcceptConfidence;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "job_offered",
      conditions: [
        {
          key: "opt_in",
          satisfied: settings.autoAcceptEnabled,
          noteEn: "Provider enabled auto-accept",
        },
        {
          key: "high_confidence",
          satisfied: conf >= settings.minAutoAcceptConfidence,
          noteEn: `Confidence ${Math.round(conf * 100)}%`,
        },
      ],
      confidence: conf,
      reasonEn:
        "High match confidence and auto-accept is enabled — job queued for automatic acceptance.",
      reasonAr:
        "ثقة مطابقة عالية وقبول تلقائي مفعّل — الطلب جاهز للقبول التلقائي.",
      dataSources: [
        "ai_provider_automation_settings",
        "match_score",
        "dispatch",
      ],
      providerId: ctx.providerId,
      userId: ctx.userId,
      serviceRequestId: ctx.serviceRequestId,
      payload: { mode: "auto_accept" },
      // Soft execute: log only — actual accept stays behind marketplace APIs
      execute: async () => ({ queued: true, note: "acceptance_queued" }),
    });
    out.push(toSuggestion(run, { en: "Auto-accept ready", ar: "قبول تلقائي جاهز" }));
  }

  if (settings.autoRejectOutOfArea && ctx.outOfAreaCandidate) {
    const wf = getWorkflow("provider.reject_out_of_area")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "job_offered",
      conditions: [
        {
          key: "out_of_area",
          satisfied: true,
          noteEn: "Request outside configured service area",
        },
      ],
      confidence: 0.96,
      reasonEn: "Request is outside your service area — safe to auto-decline.",
      reasonAr: "الطلب خارج منطقة خدمتك — يمكن رفضه تلقائياً بأمان.",
      dataSources: ["provider.service_area", "request.city_id"],
      providerId: ctx.providerId,
      serviceRequestId: ctx.serviceRequestId,
      execute: async () => ({ declined: true, reason: "out_of_area" }),
    });
    out.push(
      toSuggestion(run, {
        en: "Outside service area",
        ar: "خارج منطقة الخدمة",
      }),
    );
  }

  if (settings.autoRejectOutsideHours && ctx.outsideHoursCandidate) {
    const wf = getWorkflow("provider.reject_outside_hours")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "job_offered",
      conditions: [
        {
          key: "outside_hours",
          satisfied: true,
          noteEn: "Outside working hours",
        },
      ],
      confidence: 0.94,
      reasonEn: "Request arrived outside your working hours.",
      reasonAr: "وصل الطلب خارج ساعات عملك.",
      dataSources: ["provider_working_hours"],
      providerId: ctx.providerId,
      serviceRequestId: ctx.serviceRequestId,
    });
    out.push(
      toSuggestion(run, {
        en: "Outside working hours",
        ar: "خارج ساعات العمل",
      }),
    );
  }

  if (settings.suggestRouteOptimization && (ctx.bookingsToday ?? 0) >= 2) {
    const wf = getWorkflow("provider.suggest_route_optimization")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "schedule_loaded",
      conditions: [
        {
          key: "multi_stops",
          satisfied: true,
          noteEn: "Multiple bookings today",
        },
      ],
      confidence: 0.84,
      reasonEn: "Reorder today’s stops to cut travel time.",
      reasonAr: "أعد ترتيب محطات اليوم لتقليل وقت التنقل.",
      dataSources: ["bookings", "routing"],
      providerId: ctx.providerId,
    });
    out.push(
      toSuggestion(run, { en: "Optimize your route", ar: "حسّن مسارك" }),
    );
  }

  if (
    settings.suggestScheduleGaps &&
    ctx.freeHoursToday != null &&
    ctx.freeHoursToday >= 2
  ) {
    const wf = getWorkflow("provider.fill_schedule_gaps")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "schedule_loaded",
      conditions: [
        {
          key: "free_capacity",
          satisfied: true,
          noteEn: `${ctx.freeHoursToday}h free today`,
        },
      ],
      confidence: 0.82,
      reasonEn: "You have open capacity — fill gaps with nearby requests.",
      reasonAr: "لديك سعة فارغة — املأ الفراغات بطلبات قريبة.",
      dataSources: ["availability_forecast", "marketplace_offers"],
      providerId: ctx.providerId,
    });
    out.push(
      toSuggestion(run, { en: "Fill schedule gaps", ar: "املأ فراغات الجدول" }),
    );
  }

  if ((ctx.nearbyOpenRequests ?? 0) > 0) {
    const wf = getWorkflow("provider.recommend_nearby")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "schedule_loaded",
      conditions: [
        {
          key: "nearby_open",
          satisfied: true,
          noteEn: `${ctx.nearbyOpenRequests} nearby open`,
        },
      ],
      confidence: 0.79,
      reasonEn: `${ctx.nearbyOpenRequests} open request(s) near your area.`,
      reasonAr: `${ctx.nearbyOpenRequests} طلب(ات) مفتوحة قرب منطقتك.`,
      dataSources: ["marketplace_requests", "geo"],
      providerId: ctx.providerId,
    });
    out.push(
      toSuggestion(run, {
        en: "Nearby opportunities",
        ar: "فرص قريبة",
      }),
    );
  }

  {
    const wf = getWorkflow("provider.prepare_appointment_summary")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "appointment_upcoming",
      conditions: [
        {
          key: "has_bookings",
          satisfied: (ctx.bookingsToday ?? 0) > 0,
          noteEn: "Bookings today",
        },
      ],
      confidence: 0.88,
      reasonEn: "Appointment summaries are ready for today’s jobs.",
      reasonAr: "ملخصات المواعيد جاهزة لأعمال اليوم.",
      dataSources: ["bookings", "job_intelligence"],
      providerId: ctx.providerId,
    });
    if ((ctx.bookingsToday ?? 0) > 0) {
      out.push(
        toSuggestion(run, {
          en: "Appointment summaries",
          ar: "ملخصات المواعيد",
        }),
      );
    }
  }

  if (ctx.overloaded) {
    const wf = getWorkflow("provider.detect_overload")!;
    const run = await runWorkflow({
      workflow: wf,
      triggerKey: "schedule_loaded",
      conditions: [
        {
          key: "overloaded",
          satisfied: true,
          noteEn: "Workload overloaded",
        },
      ],
      confidence: 0.93,
      reasonEn: "Your schedule looks overloaded — pause new intake or defer low priority.",
      reasonAr: "جدولك مثقل — أوقف الاستقبال مؤقتاً أو أجّل الأولوية المنخفضة.",
      dataSources: ["availability_forecast", "bookings"],
      providerId: ctx.providerId,
    });
    out.push(
      toSuggestion(run, {
        en: "Schedule overload",
        ar: "جدول مثقل",
      }),
    );
  }

  return out;
}
