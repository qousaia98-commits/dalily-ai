/**
 * Automatic visit generation + skip / reschedule.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { nextOccurrence, parseTimeParts } from "./interval";
import { mapPlan } from "./plans";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

/**
 * Generate upcoming visits (and optional bookings) within horizon.
 * Respects vacation blocks, existing bookings, and emergency priority soft-skip.
 */
export async function generateUpcomingVisits(
  planId: string,
  opts?: { horizonDays?: number; maxVisits?: number },
): Promise<{ created: number }> {
  const horizonDays = opts?.horizonDays ?? 45;
  const maxVisits = opts?.maxVisits ?? 6;
  let created = 0;

  try {
    const admin = db();
    const { data: row } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (!row || row.status !== "active") return { created: 0 };

    const plan = mapPlan(row);
    const time = parseTimeParts(plan.preferredTimeStart);
    const horizonEnd = Date.now() + horizonDays * 86_400_000;

    const { count: existingCount } = await admin
      .from("recurring_visits")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId)
      .in("status", ["scheduled", "confirmed", "rescheduled"]);

    let cursor = plan.nextVisitAt
      ? new Date(plan.nextVisitAt)
      : new Date(plan.startDate + "T10:00:00");
    let seq = Number(existingCount ?? 0);

    while (created < maxVisits && cursor.getTime() <= horizonEnd) {
      if (plan.endDate && cursor.toISOString().slice(0, 10) > plan.endDate) {
        break;
      }

      const startsAt = new Date(cursor);
      const endsAt = new Date(
        startsAt.getTime() + plan.durationMinutes * 60_000,
      );

      // Skip if visit already exists near this slot (±6h)
      const windowStart = new Date(startsAt.getTime() - 6 * 3_600_000).toISOString();
      const windowEnd = new Date(startsAt.getTime() + 6 * 3_600_000).toISOString();
      const { data: near } = await admin
        .from("recurring_visits")
        .select("id")
        .eq("plan_id", planId)
        .gte("planned_starts_at", windowStart)
        .lte("planned_starts_at", windowEnd)
        .limit(1)
        .maybeSingle();

      if (!near) {
        // Soft check: provider blocked / vacation
        let blocked = false;
        if (plan.providerId) {
          try {
            const { data: blocks } = await admin
              .from("provider_blocked_times")
              .select("id")
              .eq("provider_id", plan.providerId)
              .lte("starts_at", endsAt.toISOString())
              .gte("ends_at", startsAt.toISOString())
              .limit(1);
            blocked = (blocks?.length ?? 0) > 0;
          } catch {
            blocked = false;
          }

          // Existing booking overlap
          if (!blocked) {
            const { data: busy } = await admin
              .from("bookings")
              .select("id, status")
              .eq("provider_id", plan.providerId)
              .not("status", "in", '("cancelled","declined","no_show")')
              .lt("starts_at", endsAt.toISOString())
              .gt("ends_at", startsAt.toISOString())
              .limit(1);
            blocked = (busy?.length ?? 0) > 0;
          }
        }

        if (!blocked) {
          seq += 1;
          let bookingId: string | null = null;

          if (plan.providerId) {
            const { data: booking } = await admin
              .from("bookings")
              .insert({
                provider_id: plan.providerId,
                customer_id: plan.customerId,
                status: "pending",
                starts_at: startsAt.toISOString(),
                ends_at: endsAt.toISOString(),
                duration_minutes: plan.durationMinutes,
                timezone: plan.timezone,
                location_text: plan.locationText,
                customer_notes: plan.notes,
                is_recurring: true,
                recurring_plan_id: plan.id,
                appointment_type: "recurring",
                requires_provider_confirmation: true,
              })
              .select("id")
              .single();
            bookingId = booking?.id ? String(booking.id) : null;
          }

          const { data: visit } = await admin
            .from("recurring_visits")
            .insert({
              plan_id: plan.id,
              booking_id: bookingId,
              sequence_number: seq,
              status: "scheduled",
              planned_starts_at: startsAt.toISOString(),
              planned_ends_at: endsAt.toISOString(),
            })
            .select("id")
            .single();

          if (bookingId && visit?.id) {
            await admin
              .from("bookings")
              .update({ recurring_visit_id: visit.id })
              .eq("id", bookingId);
          }

          created += 1;
          void emitAiLearningEvent({
            eventType: "recurring_visit_generated",
            customerId: plan.customerId,
            providerId: plan.providerId,
            metadata: { planId: plan.id, visitId: visit?.id, startsAt: startsAt.toISOString() },
          });
        }
      }

      cursor = nextOccurrence({
        from: cursor,
        intervalKind: plan.intervalKind,
        customIntervalDays: plan.customIntervalDays,
        preferredWeekdays: plan.preferredWeekdays,
        preferredHour: time.hour,
        preferredMinute: time.minute,
      });
    }

    // Update next_visit_at to earliest scheduled
    const { data: nextVisit } = await admin
      .from("recurring_visits")
      .select("planned_starts_at")
      .eq("plan_id", planId)
      .in("status", ["scheduled", "confirmed", "rescheduled"])
      .order("planned_starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    await admin
      .from("recurring_plans")
      .update({
        next_visit_at: nextVisit?.planned_starts_at ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    return { created };
  } catch {
    return { created };
  }
}

export async function skipVisit(input: {
  visitId: string;
  customerId: string;
  reason?: string | null;
}): Promise<boolean> {
  try {
    const admin = db();
    const { data: visit } = await admin
      .from("recurring_visits")
      .select("*")
      .eq("id", input.visitId)
      .maybeSingle();
    if (!visit) return false;

    const { data: plan } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("id", visit.plan_id)
      .eq("customer_id", input.customerId)
      .maybeSingle();
    if (!plan) return false;

    await admin
      .from("recurring_visits")
      .update({
        status: "skipped",
        skip_reason: input.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.visitId);

    if (visit.booking_id) {
      await admin
        .from("bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", visit.booking_id);
    }

    await admin
      .from("recurring_plans")
      .update({
        skipped_visit_count: Number(plan.skipped_visit_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id);

    void emitAiLearningEvent({
      eventType: "recurring_visit_skipped",
      customerId: input.customerId,
      providerId: plan.provider_id,
      metadata: {
        visitId: input.visitId,
        planId: plan.id,
        reason: input.reason,
      },
    });

    const { notifyPlanLifecycle } = await import("./reminders");
    await notifyPlanLifecycle({
      planId: String(plan.id),
      visitId: input.visitId,
      type: "visit_skipped",
    });

    return true;
  } catch {
    return false;
  }
}

export async function rescheduleVisit(input: {
  visitId: string;
  customerId: string;
  newStartsAt: string;
  note?: string | null;
}): Promise<boolean> {
  try {
    const admin = db();
    const { data: visit } = await admin
      .from("recurring_visits")
      .select("*")
      .eq("id", input.visitId)
      .maybeSingle();
    if (!visit) return false;

    const { data: plan } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("id", visit.plan_id)
      .eq("customer_id", input.customerId)
      .maybeSingle();
    if (!plan) return false;

    const starts = new Date(input.newStartsAt);
    const ends = new Date(
      starts.getTime() + Number(plan.duration_minutes ?? 60) * 60_000,
    );

    await admin
      .from("recurring_visits")
      .update({
        status: "rescheduled",
        planned_starts_at: starts.toISOString(),
        planned_ends_at: ends.toISOString(),
        reschedule_note: input.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.visitId);

    if (visit.booking_id) {
      await admin
        .from("bookings")
        .update({
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", visit.booking_id);
    }

    void emitAiLearningEvent({
      eventType: "recurring_visit_rescheduled",
      customerId: input.customerId,
      providerId: plan.provider_id,
      metadata: { visitId: input.visitId, newStartsAt: input.newStartsAt },
    });

    return true;
  } catch {
    return false;
  }
}

export async function markVisitCompleted(input: {
  visitId: string;
  customerId?: string | null;
}): Promise<boolean> {
  try {
    const admin = db();
    const { data: visit } = await admin
      .from("recurring_visits")
      .select("*")
      .eq("id", input.visitId)
      .maybeSingle();
    if (!visit) return false;

    const { data: plan } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("id", visit.plan_id)
      .maybeSingle();
    if (!plan) return false;
    if (input.customerId && plan.customer_id !== input.customerId) return false;

    await admin
      .from("recurring_visits")
      .update({
        status: "completed",
        actual_ends_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.visitId);

    await admin
      .from("recurring_plans")
      .update({
        completed_visit_count: Number(plan.completed_visit_count ?? 0) + 1,
        last_visit_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id);

    void emitAiLearningEvent({
      eventType: "recurring_visit_completed",
      customerId: plan.customer_id,
      providerId: plan.provider_id,
      metadata: { visitId: input.visitId, planId: plan.id },
    });

    return true;
  } catch {
    return false;
  }
}

/** Cron: generate visits for all active plans needing horizon fill. */
export async function processRecurringSchedules(): Promise<{
  plans: number;
  visitsCreated: number;
}> {
  let plans = 0;
  let visitsCreated = 0;
  try {
    const admin = db();
    const { data: rows } = await admin
      .from("recurring_plans")
      .select("id")
      .eq("status", "active")
      .limit(100);

    for (const row of rows ?? []) {
      plans += 1;
      const result = await generateUpcomingVisits(String(row.id), {
        horizonDays: 45,
        maxVisits: 4,
      });
      visitsCreated += result.created;
    }
  } catch {
    /* soft */
  }
  return { plans, visitsCreated };
}
