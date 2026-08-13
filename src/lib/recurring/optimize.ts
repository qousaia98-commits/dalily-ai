/**
 * Route / workload optimization hints for recurring visits.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export type RouteOptimizationHint = {
  providerId: string;
  date: string;
  visitIds: string[];
  messageEn: string;
  messageAr: string;
  estimatedTravelSavedMin: number;
};

/**
 * Group same-day nearby recurring visits for a provider (heuristic by location text).
 */
export async function optimizeRecurringRoutes(input?: {
  providerId?: string;
  day?: string;
}): Promise<RouteOptimizationHint[]> {
  const hints: RouteOptimizationHint[] = [];
  try {
    const admin = db();
    const day = input?.day ?? new Date().toISOString().slice(0, 10);
    const dayStart = `${day}T00:00:00.000Z`;
    const dayEnd = `${day}T23:59:59.999Z`;

    let query = admin
      .from("recurring_visits")
      .select(
        "id, planned_starts_at, plan_id, recurring_plans!inner(provider_id, location_text, customer_id)",
      )
      .gte("planned_starts_at", dayStart)
      .lte("planned_starts_at", dayEnd)
      .in("status", ["scheduled", "confirmed", "rescheduled"]);

    if (input?.providerId) {
      query = query.eq("recurring_plans.provider_id", input.providerId);
    }

    const { data: rows } = await query.limit(80);
    if (!rows?.length) return hints;

    type Row = {
      id: string;
      planned_starts_at: string;
      recurring_plans: {
        provider_id: string | null;
        location_text: string | null;
      };
    };

    const byProvider = new Map<string, Row[]>();
    for (const r of rows as Row[]) {
      const pid = r.recurring_plans?.provider_id;
      if (!pid) continue;
      const list = byProvider.get(pid) ?? [];
      list.push(r);
      byProvider.set(pid, list);
    }

    for (const [providerId, list] of byProvider) {
      if (list.length < 2) continue;
      // Group by coarse location token
      const byArea = new Map<string, Row[]>();
      for (const v of list) {
        const area = (v.recurring_plans.location_text ?? "unknown")
          .toLowerCase()
          .split(/[,\s]+/)
          .slice(0, 2)
          .join(" ");
        const g = byArea.get(area) ?? [];
        g.push(v);
        byArea.set(area, g);
      }

      for (const [area, group] of byArea) {
        if (group.length < 2) continue;
        const sorted = [...group].sort(
          (a, b) =>
            new Date(a.planned_starts_at).getTime() -
            new Date(b.planned_starts_at).getTime(),
        );
        const saved = Math.min(40, (sorted.length - 1) * 12);
        hints.push({
          providerId,
          date: day,
          visitIds: sorted.map((v) => String(v.id)),
          messageEn: `Group ${sorted.length} recurring visits near "${area}" on ${day} to cut ~${saved} min travel.`,
          messageAr: `اجمع ${sorted.length} زيارات متكررة قرب "${area}" يوم ${day} لتوفير ~${saved} دقيقة.`,
          estimatedTravelSavedMin: saved,
        });

        void emitAiLearningEvent({
          eventType: "recurring_route_optimized",
          providerId,
          metadata: {
            date: day,
            visitIds: sorted.map((v) => v.id),
            estimatedTravelSavedMin: saved,
          },
        });
      }
    }

    // Missed maintenance: active plans with overdue next_visit
    const { data: overdue } = await admin
      .from("recurring_plans")
      .select("id, customer_id, provider_id, title, next_visit_at")
      .eq("status", "active")
      .lt("next_visit_at", new Date().toISOString())
      .limit(20);

    for (const p of overdue ?? []) {
      void emitAiLearningEvent({
        eventType: "maintenance_due_detected",
        customerId: p.customer_id,
        providerId: p.provider_id,
        metadata: { planId: p.id, title: p.title },
      });
    }

    return hints;
  } catch {
    return hints;
  }
}
