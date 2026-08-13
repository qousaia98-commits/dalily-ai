/**
 * Smart predictive notifications for customers & providers.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { DemandForecastResult, MarketplaceBalance, PredictiveNotification } from "./types";

export function buildCustomerPredictiveNotifications(input: {
  demand: DemandForecastResult;
  balances: MarketplaceBalance[];
  categorySlug?: string | null;
}): PredictiveNotification[] {
  const out: PredictiveNotification[] = [];
  const cat = input.categorySlug?.toLowerCase();

  const balance = cat
    ? input.balances.find((b) => b.categorySlug?.toLowerCase() === cat)
    : input.balances[0];

  if (balance && (balance.severity === "oversupply" || balance.severity === "balanced")) {
    out.push({
      audience: "customer",
      type: "demand_low",
      titleEn: "Good time to request",
      titleAr: "وقت مناسب للطلب",
      bodyEn: "Provider capacity looks healthy right now — you may get faster responses.",
      bodyAr: "سعة المزودين جيدة الآن — قد تحصل على ردود أسرع.",
      payload: { categorySlug: balance.categorySlug },
    });
  }

  if (balance && balance.severity.includes("shortage")) {
    out.push({
      audience: "customer",
      type: "provider_scarce",
      titleEn: "High demand right now",
      titleAr: "طلب مرتفع الآن",
      bodyEn: "Fewer providers available — expect longer waits or widen your area.",
      bodyAr: "مزودون أقل توفراً — توقع انتظاراً أطول أو وسّع النطاق.",
      payload: { categorySlug: balance.categorySlug },
    });
  }

  const highlight = input.demand.highlightsEn[0];
  if (highlight && cat && highlight.toLowerCase().includes(cat)) {
    out.push({
      audience: "customer",
      type: "best_time_hint",
      titleEn: "Demand forecast tip",
      titleAr: "نصيحة توقّع الطلب",
      bodyEn: highlight,
      bodyAr: input.demand.highlightsAr[0] ?? highlight,
    });
  }

  return out;
}

export function buildProviderPredictiveNotifications(input: {
  demand: DemandForecastResult;
  freeHoursTomorrow?: number | null;
  categoryHints?: string[];
}): PredictiveNotification[] {
  const out: PredictiveNotification[] = [];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomKey = tomorrow.toISOString().slice(0, 10);

  const tomorrowPoints = input.demand.points.filter((p) => p.date === tomKey);
  const top = [...tomorrowPoints].sort(
    (a, b) => b.predictedRequests - a.predictedRequests,
  )[0];

  if (top && top.predictedRequests >= 1) {
    out.push({
      audience: "provider",
      type: "high_demand_tomorrow",
      titleEn: "High demand expected tomorrow",
      titleAr: "طلب مرتفع متوقع غداً",
      bodyEn: `${top.categorySlug} looks busy around ${top.hourBucket}:00 — keep capacity open.`,
      bodyAr: `${top.categorySlug} يبدو مزدحماً حوالي ${top.hourBucket}:00 — أبقِ سعة متاحة.`,
      payload: { categorySlug: top.categorySlug, date: tomKey },
    });
  }

  if ((input.freeHoursTomorrow ?? 0) >= 3) {
    out.push({
      audience: "provider",
      type: "free_capacity",
      titleEn: "You have free capacity nearby",
      titleAr: "لديك سعة فارغة قريبة",
      bodyEn: "Open opportunities that match your free hours to fill the gap.",
      bodyAr: "افتح الفرص التي تناسب ساعات فراغك لملء الفجوة.",
    });
  }

  if (input.categoryHints?.length) {
    out.push({
      audience: "provider",
      type: "demand_increasing",
      titleEn: "Demand for your services is increasing",
      titleAr: "الطلب على خدماتك في ازدياد",
      bodyEn: `Rising interest in: ${input.categoryHints.slice(0, 3).join(", ")}.`,
      bodyAr: `اهتمام متزايد بـ: ${input.categoryHints.slice(0, 3).join("، ")}.`,
    });
  }

  return out;
}

export async function persistPredictiveNotifications(
  notifications: PredictiveNotification[],
  opts?: { userId?: string | null; providerId?: string | null },
): Promise<PredictiveNotification[]> {
  if (!notifications.length) return [];
  try {
    const admin = createAdminClient();
    const rows = notifications.map((n) => ({
      audience: n.audience,
      user_id: opts?.userId ?? null,
      provider_id: opts?.providerId ?? null,
      notification_type: n.type,
      title_en: n.titleEn,
      title_ar: n.titleAr,
      body_en: n.bodyEn,
      body_ar: n.bodyAr,
      payload: (n.payload ?? {}) as Json,
      status: "shown",
    }));
    const { data } = await admin
      .from("ai_predictive_notifications")
      .insert(rows as never)
      .select("id");
    return notifications.map((n, i) => ({
      ...n,
      id: (data?.[i] as { id?: string } | undefined)?.id,
    }));
  } catch {
    return notifications;
  }
}

export async function markNotificationClicked(notificationId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    await admin
      .from("ai_predictive_notifications")
      .update({
        status: "clicked",
        resolved_at: new Date().toISOString(),
      } as never)
      .eq("id", notificationId);

    void emitAiLearningEvent({
      eventType: "notification_clicked",
      metadata: { notificationId },
    });
    return true;
  } catch {
    return false;
  }
}
