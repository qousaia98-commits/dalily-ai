/**
 * Recurring plan reminders (upcoming, renewal, skip, pause, cancel, due).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

type ReminderType =
  | "upcoming_visit"
  | "plan_renewal"
  | "visit_skipped"
  | "plan_paused"
  | "plan_cancelled"
  | "maintenance_due";

async function alreadySent(
  planId: string,
  visitId: string | null,
  type: ReminderType,
): Promise<boolean> {
  try {
    const admin = db();
    let q = admin
      .from("recurring_reminder_log")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId)
      .eq("reminder_type", type);
    if (visitId) q = q.eq("visit_id", visitId);
    const { count } = await q;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function logSent(
  planId: string,
  visitId: string | null,
  type: ReminderType,
) {
  try {
    await db().from("recurring_reminder_log").insert({
      plan_id: planId,
      visit_id: visitId,
      reminder_type: type,
    });
  } catch {
    /* soft */
  }
}

async function notifyUser(input: {
  userId: string;
  titleKey: string;
  bodyKey: string;
  href: string;
  planId: string;
}) {
  try {
    const admin = db();
    await admin.rpc("notify_marketplace_user", {
      p_user_id: input.userId,
      p_type: "recurring_reminder",
      p_title_key: input.titleKey,
      p_body_key: input.bodyKey,
      p_body_params: {},
      p_href: input.href,
      p_request_id: null,
    });
  } catch {
    try {
      const { deliverMarketplaceNotification } = await import(
        "@/lib/notifications/deliver"
      );
      await deliverMarketplaceNotification({
        userId: input.userId,
        type: "system",
        titleKey: input.titleKey,
        bodyKey: input.bodyKey,
        href: input.href,
      });
    } catch {
      /* soft */
    }
  }
}

export async function notifyPlanLifecycle(input: {
  planId: string;
  visitId?: string | null;
  type: ReminderType;
}): Promise<void> {
  try {
    const admin = db();
    const { data: plan } = await admin
      .from("recurring_plans")
      .select("id, customer_id, provider_id, title")
      .eq("id", input.planId)
      .maybeSingle();
    if (!plan) return;

    if (
      await alreadySent(input.planId, input.visitId ?? null, input.type)
    ) {
      return;
    }

    await notifyUser({
      userId: String(plan.customer_id),
      titleKey: `recurring.reminders.${input.type}.title`,
      bodyKey: `recurring.reminders.${input.type}.body`,
      href: `/account/recurring`,
      planId: input.planId,
    });

    if (plan.provider_id) {
      const { data: provider } = await admin
        .from("providers")
        .select("owner_id")
        .eq("id", plan.provider_id)
        .maybeSingle();
      if (provider?.owner_id) {
        await notifyUser({
          userId: String(provider.owner_id),
          titleKey: `recurring.reminders.${input.type}.title`,
          bodyKey: `recurring.reminders.${input.type}.body`,
          href: `/business/bookings`,
          planId: input.planId,
        });
      }
    }

    await logSent(input.planId, input.visitId ?? null, input.type);
    void emitAiLearningEvent({
      eventType: "recurring_reminder_sent",
      customerId: plan.customer_id,
      providerId: plan.provider_id,
      metadata: { planId: input.planId, type: input.type },
    });
  } catch {
    /* soft */
  }
}

export async function processRecurringReminders(): Promise<{
  upcoming: number;
  renewals: number;
  due: number;
}> {
  let upcoming = 0;
  let renewals = 0;
  let due = 0;

  try {
    const admin = db();
    const in24h = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const now = new Date().toISOString();

    const { data: visits } = await admin
      .from("recurring_visits")
      .select("id, plan_id, planned_starts_at")
      .in("status", ["scheduled", "confirmed", "rescheduled"])
      .gte("planned_starts_at", now)
      .lte("planned_starts_at", in24h)
      .limit(50);

    for (const v of visits ?? []) {
      await notifyPlanLifecycle({
        planId: String(v.plan_id),
        visitId: String(v.id),
        type: "upcoming_visit",
      });
      upcoming += 1;
    }

    const in14d = new Date(Date.now() + 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data: renewing } = await admin
      .from("recurring_plans")
      .select("id, end_date")
      .eq("status", "active")
      .eq("auto_renew", true)
      .not("end_date", "is", null)
      .lte("end_date", in14d)
      .limit(40);

    for (const p of renewing ?? []) {
      await notifyPlanLifecycle({
        planId: String(p.id),
        type: "plan_renewal",
      });
      renewals += 1;
    }

    const { data: overdue } = await admin
      .from("recurring_plans")
      .select("id")
      .eq("status", "active")
      .lt("next_visit_at", now)
      .limit(30);

    for (const p of overdue ?? []) {
      await notifyPlanLifecycle({
        planId: String(p.id),
        type: "maintenance_due",
      });
      due += 1;
    }
  } catch {
    /* soft */
  }

  return { upcoming, renewals, due };
}
