/**
 * Customer personal assistant — job-lifecycle guidance.
 */

import type { MarketplaceOfferView } from "@/domains/offer/types";
import { upsertAssistantContext } from "./context";
import { compareAndStoreOffers } from "./offers";
import { buildAppointmentBriefing } from "./appointment";
import { buildAfterJobAssist } from "./after-job";
import {
  buildCustomerSuggestions,
  persistSuggestions,
} from "./suggestions";
import type {
  AssistantJobPhase,
  CustomerAssistantView,
} from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

function inferPhase(input: {
  offerCount: number;
  hasSelection: boolean;
  hasUnlock: boolean;
  hasConversation: boolean;
  hasAppointment: boolean;
  isCompleted: boolean;
}): AssistantJobPhase {
  if (input.isCompleted) return "completed";
  if (input.hasAppointment) return "appointment";
  if (input.hasConversation) return "chat";
  if (input.hasUnlock) return "unlock";
  if (input.hasSelection) return "offers";
  if (input.offerCount > 0) return "offers";
  return "matching";
}

function stepCopy(phase: AssistantJobPhase): {
  en: string;
  ar: string;
  nextEn: string;
  nextAr: string;
} {
  switch (phase) {
    case "matching":
      return {
        en: "We’re notifying matching businesses. You stay in control of contact details.",
        ar: "نُخطر الأنشطة المطابقة. أنت تتحكم ببيانات التواصل.",
        nextEn: "Wait for offers, or add a photo to improve matches.",
        nextAr: "انتظر العروض، أو أضف صورة لتحسين المطابقة.",
      };
    case "offers":
      return {
        en: "Compare offers on quality, speed, and fit — not price alone.",
        ar: "قارن العروض حسب الجودة والسرعة والملاءمة — وليس السعر وحده.",
        nextEn: "Open the comparison, then select the best overall fit.",
        nextAr: "افتح المقارنة ثم اختر الأنسب إجمالاً.",
      };
    case "unlock":
      return {
        en: "You’ve selected an offer. Unlock releases contact when payment/bypass succeeds.",
        ar: "اخترت عرضاً. فتح التواصل يتم بعد نجاح الدفع/التجاوز.",
        nextEn: "Complete unlock to message the business.",
        nextAr: "أكمل فتح التواصل لمراسلة النشاط.",
      };
    case "chat":
      return {
        en: "You’re connected. Align on time, access, and materials before the visit.",
        ar: "أنتم متصلون. اتفقوا على الوقت والوصول والمواد قبل الزيارة.",
        nextEn: "Confirm the appointment details in chat.",
        nextAr: "أكّد تفاصيل الموعد في المحادثة.",
      };
    case "appointment":
      return {
        en: "Your appointment is set. Review the prep briefing below.",
        ar: "تم تحديد الموعد. راجع ملخص التحضير أدناه.",
        nextEn: "Be ready on site at the scheduled time.",
        nextAr: "كن جاهزاً في الموقع في الوقت المحدد.",
      };
    case "completed":
      return {
        en: "Job finished. A short review helps the next customer.",
        ar: "اكتملت الخدمة. تقييم قصير يساعد العميل التالي.",
        nextEn: "Leave a review and note any follow-up needs.",
        nextAr: "اترك تقييماً ولاحظ أي حاجة لمتابعة.",
      };
    default:
      return {
        en: "Describe your problem so we can match the right businesses.",
        ar: "صف مشكلتك لنطابق الأنشطة المناسبة.",
        nextEn: "Continue the intake steps.",
        nextAr: "تابع خطوات الطلب.",
      };
  }
}

export async function buildCustomerAssistant(input: {
  serviceRequestId: string;
  customerId: string;
  intentText: string;
  categorySlug?: string | null;
  urgency?: string | null;
  locationText?: string | null;
  hasPhoto: boolean;
  hasLocation: boolean;
  offers: MarketplaceOfferView[];
  selectionOfferId?: string | null;
  hasUnlock?: boolean;
  conversationId?: string | null;
  appointmentStartsAt?: string | null;
  isCompleted?: boolean;
  hoursSinceActivity?: number | null;
  prepTools?: string[];
  prepMaterials?: string[];
  prepDuration?: string | null;
}): Promise<CustomerAssistantView> {
  const phase = inferPhase({
    offerCount: input.offers.length,
    hasSelection: Boolean(input.selectionOfferId),
    hasUnlock: Boolean(input.hasUnlock),
    hasConversation: Boolean(input.conversationId),
    hasAppointment: Boolean(input.appointmentStartsAt),
    isCompleted: Boolean(input.isCompleted),
  });

  const copy = stepCopy(phase);

  const context = await upsertAssistantContext({
    serviceRequestId: input.serviceRequestId,
    audience: "customer",
    phase,
    conversationId: input.conversationId,
    mergeFacts: true,
    confirmedFacts: {
      categorySlug: input.categorySlug,
      urgency: input.urgency,
      locationText: input.locationText,
      hasPhoto: input.hasPhoto,
      problemSummary: input.intentText.slice(0, 240),
      selectedOfferId: input.selectionOfferId,
      appointmentAt: input.appointmentStartsAt,
    },
  });

  const suggestionsRaw = buildCustomerSuggestions({
    hasPhoto: input.hasPhoto,
    hasLocation: input.hasLocation,
    intentLength: input.intentText.length,
    offerCount: input.offers.length,
    hoursSinceLastCustomerActivity: input.hoursSinceActivity,
    appointmentStartsAt: input.appointmentStartsAt,
  });

  const suggestions = await persistSuggestions({
    suggestions: suggestionsRaw,
    audience: "customer",
    serviceRequestId: input.serviceRequestId,
    customerId: input.customerId,
  });

  const offerComparison =
    input.offers.length >= 2
      ? await compareAndStoreOffers({
          serviceRequestId: input.serviceRequestId,
          offers: input.offers,
        })
      : input.offers.length === 1
        ? await compareAndStoreOffers({
            serviceRequestId: input.serviceRequestId,
            offers: input.offers,
          })
        : null;

  const appointment = input.appointmentStartsAt
    ? buildAppointmentBriefing({
        problemSummary: input.intentText,
        locationText: input.locationText,
        startsAt: input.appointmentStartsAt,
        estimatedDurationLabel: input.prepDuration,
        tools: input.prepTools,
        materials: input.prepMaterials,
        serviceRequestId: input.serviceRequestId,
      })
    : null;

  const afterJob = input.isCompleted
    ? buildAfterJobAssist({
        problemSummary: input.intentText,
        categorySlug: input.categorySlug,
        serviceRequestId: input.serviceRequestId,
      })
    : null;

  const missingInfo: string[] = [];
  if (!input.hasPhoto) missingInfo.push("photo");
  if (!input.hasLocation) missingInfo.push("location");

  void emitAiLearningEvent({
    eventType: "assistant_shown",
    serviceRequestId: input.serviceRequestId,
    customerId: input.customerId,
    metadata: { audience: "customer", phase },
  });

  return {
    phase,
    stepExplanationEn: copy.en,
    stepExplanationAr: copy.ar,
    nextActionEn: copy.nextEn,
    nextActionAr: copy.nextAr,
    missingInfo,
    suggestions,
    offerComparison,
    appointment,
    afterJob,
    context: context ?? {
      serviceRequestId: input.serviceRequestId,
      audience: "customer",
      phase,
      confirmedFacts: {},
      askedQuestions: [],
    },
  };
}
