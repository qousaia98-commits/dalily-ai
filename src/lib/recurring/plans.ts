/**
 * Create / manage recurring plans + maintenance contracts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { nextOccurrence, parseTimeParts } from "./interval";
import type {
  MaintenanceContract,
  RecurringIntervalKind,
  RecurringPlan,
  RecurringPlanStatus,
} from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapPlan(row: Record<string, unknown>): RecurringPlan {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    providerId: row.provider_id ? String(row.provider_id) : null,
    categorySlug: row.category_slug ? String(row.category_slug) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    intervalKind: row.interval_kind as RecurringIntervalKind,
    customIntervalDays:
      row.custom_interval_days == null
        ? null
        : Number(row.custom_interval_days),
    status: row.status as RecurringPlanStatus,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    autoRenew: Boolean(row.auto_renew),
    preferredWeekdays: (row.preferred_weekdays as number[]) ?? [],
    preferredTimeStart: row.preferred_time_start
      ? String(row.preferred_time_start).slice(0, 5)
      : null,
    preferredTimeEnd: row.preferred_time_end
      ? String(row.preferred_time_end).slice(0, 5)
      : null,
    durationMinutes: Number(row.duration_minutes ?? 60),
    timezone: String(row.timezone ?? "Asia/Damascus"),
    locationText: row.location_text ? String(row.location_text) : null,
    emergencyContact: row.emergency_contact
      ? String(row.emergency_contact)
      : null,
    notes: row.notes ? String(row.notes) : null,
    nextVisitAt: row.next_visit_at ? String(row.next_visit_at) : null,
    lastVisitAt: row.last_visit_at ? String(row.last_visit_at) : null,
    renewCount: Number(row.renew_count ?? 0),
    completedVisitCount: Number(row.completed_visit_count ?? 0),
    skippedVisitCount: Number(row.skipped_visit_count ?? 0),
    createdAt: String(row.created_at),
  };
}

export async function createRecurringPlan(input: {
  customerId: string;
  providerId?: string | null;
  categorySlug?: string | null;
  serviceId?: string | null;
  title: string;
  description?: string | null;
  intervalKind: RecurringIntervalKind;
  customIntervalDays?: number | null;
  startDate: string;
  endDate?: string | null;
  autoRenew?: boolean;
  preferredWeekdays?: number[];
  preferredTimeStart?: string | null;
  preferredTimeEnd?: string | null;
  durationMinutes?: number;
  locationText?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  createContract?: boolean;
}): Promise<{ plan: RecurringPlan; contract: MaintenanceContract | null } | null> {
  try {
    const admin = db();
    const time = parseTimeParts(input.preferredTimeStart);
    const start = new Date(`${input.startDate}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00`);
    const firstVisit = nextOccurrence({
      from: new Date(start.getTime() - 86_400_000),
      intervalKind: input.intervalKind,
      customIntervalDays: input.customIntervalDays,
      preferredWeekdays: input.preferredWeekdays,
      preferredHour: time.hour,
      preferredMinute: time.minute,
    });
    // Prefer start_date itself when it already matches preference
    if (start >= new Date(Date.now() - 86_400_000)) {
      firstVisit.setTime(start.getTime());
    }

    const { data: row, error } = await admin
      .from("recurring_plans")
      .insert({
        customer_id: input.customerId,
        provider_id: input.providerId ?? null,
        category_slug: input.categorySlug ?? null,
        service_id: input.serviceId ?? null,
        title: input.title.trim(),
        description: input.description ?? null,
        interval_kind: input.intervalKind,
        custom_interval_days:
          input.intervalKind === "custom"
            ? input.customIntervalDays ?? 30
            : null,
        status: "active",
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        auto_renew: input.autoRenew !== false,
        preferred_weekdays: input.preferredWeekdays ?? [],
        preferred_time_start: input.preferredTimeStart ?? null,
        preferred_time_end: input.preferredTimeEnd ?? null,
        duration_minutes: input.durationMinutes ?? 60,
        location_text: input.locationText ?? null,
        emergency_contact: input.emergencyContact ?? null,
        notes: input.notes ?? null,
        next_visit_at: firstVisit.toISOString(),
      })
      .select("*")
      .single();

    if (error || !row) return null;
    const plan = mapPlan(row);

    let contract: MaintenanceContract | null = null;
    if (input.createContract !== false) {
      const { data: c } = await admin
        .from("maintenance_contracts")
        .insert({
          plan_id: plan.id,
          customer_id: input.customerId,
          provider_id: input.providerId ?? null,
          contract_start: input.startDate,
          contract_end: input.endDate ?? null,
          auto_renew: input.autoRenew !== false,
          preferred_weekdays: input.preferredWeekdays ?? [],
          preferred_time_start: input.preferredTimeStart ?? null,
          preferred_time_end: input.preferredTimeEnd ?? null,
          emergency_contact: input.emergencyContact ?? null,
          terms_notes: input.notes ?? null,
        })
        .select("*")
        .single();

      if (c) {
        contract = {
          id: String(c.id),
          planId: String(c.plan_id),
          customerId: String(c.customer_id),
          providerId: c.provider_id ? String(c.provider_id) : null,
          contractStart: String(c.contract_start),
          contractEnd: c.contract_end ? String(c.contract_end) : null,
          autoRenew: Boolean(c.auto_renew),
          preferredWeekdays: (c.preferred_weekdays as number[]) ?? [],
          preferredTimeStart: c.preferred_time_start
            ? String(c.preferred_time_start).slice(0, 5)
            : null,
          preferredTimeEnd: c.preferred_time_end
            ? String(c.preferred_time_end).slice(0, 5)
            : null,
          emergencyContact: c.emergency_contact
            ? String(c.emergency_contact)
            : null,
          termsNotes: c.terms_notes ? String(c.terms_notes) : null,
          renewalNoticeDays: Number(c.renewal_notice_days ?? 14),
        };
      }
    }

    void emitAiLearningEvent({
      eventType: "recurring_plan_created",
      customerId: input.customerId,
      providerId: input.providerId,
      metadata: {
        planId: plan.id,
        intervalKind: plan.intervalKind,
        categorySlug: plan.categorySlug,
      },
    });

    // Seed first visit generation
    const { generateUpcomingVisits } = await import("./schedule");
    await generateUpcomingVisits(plan.id, { horizonDays: 60 });

    return { plan, contract };
  } catch {
    return null;
  }
}

export async function setPlanStatus(input: {
  planId: string;
  customerId: string;
  status: Extract<RecurringPlanStatus, "paused" | "active" | "cancelled">;
}): Promise<boolean> {
  try {
    const admin = db();
    const { data: plan } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("id", input.planId)
      .eq("customer_id", input.customerId)
      .maybeSingle();
    if (!plan) return false;

    const patch: Record<string, unknown> = {
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    if (input.status === "paused") patch.paused_at = new Date().toISOString();
    if (input.status === "cancelled") {
      patch.cancelled_at = new Date().toISOString();
      patch.next_visit_at = null;
    }
    if (input.status === "active") {
      patch.paused_at = null;
      const time = parseTimeParts(
        plan.preferred_time_start
          ? String(plan.preferred_time_start)
          : null,
      );
      const next = nextOccurrence({
        from: new Date(),
        intervalKind: plan.interval_kind,
        customIntervalDays: plan.custom_interval_days,
        preferredWeekdays: plan.preferred_weekdays ?? [],
        preferredHour: time.hour,
        preferredMinute: time.minute,
      });
      patch.next_visit_at = next.toISOString();
    }

    await admin.from("recurring_plans").update(patch).eq("id", input.planId);

    const learn =
      input.status === "paused"
        ? "recurring_plan_paused"
        : input.status === "cancelled"
          ? "recurring_plan_cancelled"
          : "recurring_plan_resumed";
    void emitAiLearningEvent({
      eventType: learn as "recurring_plan_paused",
      customerId: input.customerId,
      providerId: plan.provider_id,
      metadata: { planId: input.planId },
    });

    if (input.status === "paused" || input.status === "cancelled") {
      const { notifyPlanLifecycle } = await import("./reminders");
      await notifyPlanLifecycle({
        planId: input.planId,
        type: input.status === "paused" ? "plan_paused" : "plan_cancelled",
      });
    }

    return true;
  } catch {
    return false;
  }
}

export async function renewPlan(input: {
  planId: string;
  customerId: string;
  extendMonths?: number;
}): Promise<boolean> {
  try {
    const admin = db();
    const { data: plan } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("id", input.planId)
      .eq("customer_id", input.customerId)
      .maybeSingle();
    if (!plan) return false;

    const months = input.extendMonths ?? 12;
    const base = plan.end_date
      ? new Date(String(plan.end_date))
      : new Date();
    base.setMonth(base.getMonth() + months);
    const endDate = base.toISOString().slice(0, 10);

    await admin
      .from("recurring_plans")
      .update({
        end_date: endDate,
        status: "active",
        renew_count: Number(plan.renew_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.planId);

    await admin
      .from("maintenance_contracts")
      .update({
        contract_end: endDate,
        updated_at: new Date().toISOString(),
      })
      .eq("plan_id", input.planId);

    void emitAiLearningEvent({
      eventType: "recurring_plan_renewed",
      customerId: input.customerId,
      providerId: plan.provider_id,
      metadata: { planId: input.planId, endDate },
    });
    return true;
  } catch {
    return false;
  }
}

export { mapPlan };
