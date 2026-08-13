/**
 * Proactive suggestions for customer & provider.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { ProactiveSuggestion, ProactiveSuggestionType } from "./types";

export function buildCustomerSuggestions(input: {
  hasPhoto: boolean;
  hasLocation: boolean;
  intentLength: number;
  offerCount: number;
  hoursSinceLastCustomerActivity?: number | null;
  appointmentStartsAt?: string | null;
}): ProactiveSuggestion[] {
  const out: ProactiveSuggestion[] = [];

  if (!input.hasPhoto && input.intentLength >= 8) {
    out.push({
      type: "missing_photo",
      titleEn: "Add a photo",
      titleAr: "أضف صورة",
      bodyEn: "A clear photo helps businesses prepare and send better offers.",
      bodyAr: "صورة واضحة تساعد الأنشطة على التحضير وتقديم عروض أفضل.",
      actionKey: "upload_photo",
      priority: 80,
    });
  }

  if (!input.hasLocation) {
    out.push({
      type: "incomplete_request",
      titleEn: "Confirm your area",
      titleAr: "أكّد منطقتك",
      bodyEn: "City/area improves matching accuracy.",
      bodyAr: "المدينة/المنطقة تحسّن دقة المطابقة.",
      actionKey: "add_location",
      priority: 70,
    });
  }

  if (
    input.hoursSinceLastCustomerActivity != null &&
    input.hoursSinceLastCustomerActivity >= 48 &&
    input.offerCount > 0
  ) {
    out.push({
      type: "customer_no_response",
      titleEn: "Offers are waiting",
      titleAr: "عروض بانتظارك",
      bodyEn: "You have offers older than two days — compare and choose when ready.",
      bodyAr: "لديك عروض منذ أكثر من يومين — قارن واختر عندما تكون جاهزاً.",
      actionKey: "review_offers",
      priority: 90,
    });
  }

  if (input.appointmentStartsAt) {
    const ms = new Date(input.appointmentStartsAt).getTime() - Date.now();
    if (ms > 0 && ms <= 60 * 60 * 1000) {
      out.push({
        type: "appointment_soon",
        titleEn: "Appointment in about an hour",
        titleAr: "الموعد خلال حوالي ساعة",
        bodyEn: "Review the prep summary and be ready on site.",
        bodyAr: "راجع ملخص التحضير وكن جاهزاً في الموقع.",
        actionKey: "view_appointment",
        priority: 95,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export function buildProviderSuggestions(input: {
  freeSlotNearby?: boolean;
  missedOpportunities?: number;
  nextJobStartsAt?: string | null;
}): ProactiveSuggestion[] {
  const out: ProactiveSuggestion[] = [];

  if (input.freeSlotNearby) {
    out.push({
      type: "nearby_slot",
      titleEn: "Free slot nearby",
      titleAr: "فراغ قريب",
      bodyEn: "A matching opportunity is close to your next job — consider it.",
      bodyAr: "فرصة مطابقة قريبة من عملك التالي — راجعها.",
      actionKey: "view_opportunities",
      priority: 75,
    });
  }

  if ((input.missedOpportunities ?? 0) > 0) {
    out.push({
      type: "missed_opportunity",
      titleEn: "Missed opportunities",
      titleAr: "فرص فائتة",
      bodyEn: `${input.missedOpportunities} recent opportunities expired without a response.`,
      bodyAr: `${input.missedOpportunities} فرص حديثة انتهت دون رد.`,
      actionKey: "view_opportunities",
      priority: 65,
    });
  }

  if (input.nextJobStartsAt) {
    const ms = new Date(input.nextJobStartsAt).getTime() - Date.now();
    if (ms > 0 && ms <= 60 * 60 * 1000) {
      out.push({
        type: "appointment_soon",
        titleEn: "Job starts soon",
        titleAr: "العمل يبدأ قريباً",
        bodyEn: "Open the preparation summary and travel plan.",
        bodyAr: "افتح ملخص التحضير وخطة الوصول.",
        actionKey: "view_booking",
        priority: 95,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export async function persistSuggestions(input: {
  suggestions: ProactiveSuggestion[];
  audience: "customer" | "provider";
  serviceRequestId?: string | null;
  bookingId?: string | null;
  providerId?: string | null;
  customerId?: string | null;
}): Promise<ProactiveSuggestion[]> {
  if (!input.suggestions.length) return [];
  try {
    const admin = createAdminClient();
    const rows = input.suggestions.map((s) => ({
      service_request_id: input.serviceRequestId ?? null,
      booking_id: input.bookingId ?? null,
      provider_id: input.providerId ?? null,
      customer_id: input.customerId ?? null,
      audience: input.audience,
      suggestion_type: s.type,
      title_en: s.titleEn,
      title_ar: s.titleAr,
      body_en: s.bodyEn,
      body_ar: s.bodyAr,
      action_key: s.actionKey ?? null,
      priority: s.priority,
      status: "shown",
      payload: (s.payload ?? {}) as Json,
    }));
    const { data } = await admin
      .from("ai_proactive_suggestions")
      .insert(rows as never)
      .select("id, suggestion_type");

    if (!data?.length) return input.suggestions;

    return input.suggestions.map((s, i) => ({
      ...s,
      id: (data[i] as { id?: string } | undefined)?.id ?? s.id,
    }));
  } catch {
    return input.suggestions;
  }
}

export async function resolveSuggestionFeedback(input: {
  suggestionId: string;
  status: "accepted" | "ignored" | "rejected";
  serviceRequestId?: string | null;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("ai_proactive_suggestions")
      .update({
        status: input.status,
        resolved_at: new Date().toISOString(),
      } as never)
      .eq("id", input.suggestionId);

    if (error) return false;

    const eventType =
      input.status === "accepted"
        ? "assistant_suggestion_accepted"
        : input.status === "rejected"
          ? "assistant_suggestion_rejected"
          : "assistant_suggestion_ignored";

    void emitAiLearningEvent({
      eventType,
      serviceRequestId: input.serviceRequestId,
      metadata: { suggestionId: input.suggestionId },
    });

    return true;
  } catch {
    return false;
  }
}

export type { ProactiveSuggestionType };
