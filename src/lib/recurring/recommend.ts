/**
 * AI recommendations for recurring / maintenance plans.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { RecurringIntervalKind, RecurringRecommendation } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

const CATEGORY_HINTS: Record<
  string,
  { interval: RecurringIntervalKind; titleEn: string; titleAr: string }
> = {
  cleaning: {
    interval: "biweekly",
    titleEn: "Biweekly cleaning plan",
    titleAr: "خطة تنظيف كل أسبوعين",
  },
  hvac: {
    interval: "semiannual",
    titleEn: "HVAC maintenance plan",
    titleAr: "خطة صيانة تكييف",
  },
  gardening: {
    interval: "monthly",
    titleEn: "Monthly garden maintenance",
    titleAr: "صيانة حديقة شهرية",
  },
  painting: {
    interval: "yearly",
    titleEn: "Annual touch-up plan",
    titleAr: "خطة لمسات سنوية",
  },
};

/**
 * Infer recommendation from repeat bookings with same provider/category.
 */
export async function recommendRecurringFromHistory(input: {
  customerId: string;
}): Promise<RecurringRecommendation[]> {
  const out: RecurringRecommendation[] = [];
  try {
    const admin = db();
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString();

    const { data: bookings } = await admin
      .from("bookings")
      .select("id, provider_id, service_id, starts_at, status, completed_at")
      .eq("customer_id", input.customerId)
      .gte("starts_at", since)
      .in("status", ["completed", "confirmed", "in_progress"])
      .order("starts_at", { ascending: false })
      .limit(80);

    if (!bookings?.length) return out;

    // Group by provider
    const byProvider = new Map<
      string,
      Array<{ id: string; starts_at: string }>
    >();
    for (const b of bookings) {
      const key = String(b.provider_id);
      const list = byProvider.get(key) ?? [];
      list.push({ id: String(b.id), starts_at: String(b.starts_at) });
      byProvider.set(key, list);
    }

    for (const [providerId, list] of byProvider) {
      if (list.length < 3) continue;

      // Estimate cadence from gaps
      const times = list
        .map((x) => new Date(x.starts_at).getTime())
        .sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < times.length; i++) {
        gaps.push((times[i] - times[i - 1]) / 86_400_000);
      }
      const avgGap =
        gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);

      let suggested: RecurringIntervalKind = "monthly";
      if (avgGap <= 10) suggested = "weekly";
      else if (avgGap <= 18) suggested = "biweekly";
      else if (avgGap <= 40) suggested = "monthly";
      else if (avgGap <= 100) suggested = "quarterly";
      else suggested = "semiannual";

      // Skip if pending recommendation already exists
      const { data: existing } = await admin
        .from("recurring_recommendations")
        .select("id")
        .eq("customer_id", input.customerId)
        .eq("provider_id", providerId)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      // Skip if active plan already with this provider
      const { data: plan } = await admin
        .from("recurring_plans")
        .select("id")
        .eq("customer_id", input.customerId)
        .eq("provider_id", providerId)
        .in("status", ["active", "paused"])
        .limit(1)
        .maybeSingle();
      if (plan) continue;

      const titleEn = `Recurring visits every ${suggested.replace("bi", "2 ")}`;
      const titleAr = `زيارات متكررة (${suggested})`;
      const reasonEn = `You booked this provider ${list.length} times (~every ${Math.round(avgGap)} days). A ${suggested} plan saves rebooking and keeps maintenance on schedule.`;
      const reasonAr = `حجزت هذا المزود ${list.length} مرات (كل ~${Math.round(avgGap)} يوماً). خطة ${suggested} توفر إعادة الحجز وتحافظ على الصيانة.`;

      const { data: rec } = await admin
        .from("recurring_recommendations")
        .insert({
          customer_id: input.customerId,
          provider_id: providerId,
          suggested_interval: suggested,
          title_en: titleEn,
          title_ar: titleAr,
          reason_en: reasonEn,
          reason_ar: reasonAr,
          status: "pending",
          based_on_booking_ids: list.map((x) => x.id),
        })
        .select("*")
        .single();

      if (rec) {
        out.push({
          id: String(rec.id),
          customerId: input.customerId,
          categorySlug: null,
          suggestedInterval: suggested,
          titleEn,
          titleAr,
          reasonEn,
          reasonAr,
          status: "pending",
          createdAt: String(rec.created_at),
        });
        void emitAiLearningEvent({
          eventType: "recurring_recommendation_shown",
          customerId: input.customerId,
          providerId,
          metadata: { recommendationId: rec.id, suggested },
        });
      }
    }

    // Category-based soft hints from completed service requests (optional)
    for (const [slug, hint] of Object.entries(CATEGORY_HINTS)) {
      void slug;
      void hint;
    }

    return out;
  } catch {
    return out;
  }
}

export async function resolveRecommendation(input: {
  recommendationId: string;
  customerId: string;
  accept: boolean;
}): Promise<{ ok: boolean; planId?: string }> {
  try {
    const admin = db();
    const { data: rec } = await admin
      .from("recurring_recommendations")
      .select("*")
      .eq("id", input.recommendationId)
      .eq("customer_id", input.customerId)
      .eq("status", "pending")
      .maybeSingle();
    if (!rec) return { ok: false };

    if (!input.accept) {
      await admin
        .from("recurring_recommendations")
        .update({
          status: "rejected",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.recommendationId);
      void emitAiLearningEvent({
        eventType: "recurring_recommendation_rejected",
        customerId: input.customerId,
        providerId: rec.provider_id,
        metadata: { recommendationId: input.recommendationId },
      });
      return { ok: true };
    }

    const { createRecurringPlan } = await import("./plans");
    const startDate = new Date().toISOString().slice(0, 10);
    const created = await createRecurringPlan({
      customerId: input.customerId,
      providerId: rec.provider_id,
      categorySlug: rec.category_slug,
      title: String(rec.title_en),
      intervalKind: rec.suggested_interval as RecurringIntervalKind,
      startDate,
      createContract: true,
    });

    await admin
      .from("recurring_recommendations")
      .update({
        status: "accepted",
        resolved_at: new Date().toISOString(),
        created_plan_id: created?.plan.id ?? null,
      })
      .eq("id", input.recommendationId);

    void emitAiLearningEvent({
      eventType: "recurring_recommendation_accepted",
      customerId: input.customerId,
      providerId: rec.provider_id,
      metadata: {
        recommendationId: input.recommendationId,
        planId: created?.plan.id,
      },
    });

    return { ok: true, planId: created?.plan.id };
  } catch {
    return { ok: false };
  }
}
