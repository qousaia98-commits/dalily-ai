/**
 * Provider personal assistant — schedule, prep, workload, next jobs.
 */

import {
  buildProviderSuggestions,
  persistSuggestions,
} from "./suggestions";
import type { ProviderAssistantView, ConversationSummary } from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export type ProviderBookingLite = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
};

export type ProviderOpportunityLite = {
  assignmentId: string;
  title: string;
  cityLabel?: string | null;
  urgency?: string | null;
};

export async function buildProviderAssistant(input: {
  providerId: string;
  bookings: ProviderBookingLite[];
  opportunities: ProviderOpportunityLite[];
  missedOpportunities?: number;
  conversationSummary?: ConversationSummary | null;
  customerSummaryEn?: string | null;
  customerSummaryAr?: string | null;
  preparationNotes?: string[];
  freeSlotNearby?: boolean;
}): Promise<ProviderAssistantView> {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todaySchedule = input.bookings
    .filter((b) => {
      const t = new Date(b.startsAt).getTime();
      return t >= startOfDay.getTime() && t <= endOfDay.getTime();
    })
    .map((b) => ({
      bookingId: b.id,
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    }));

  const upcomingJobs = input.bookings
    .filter((b) => new Date(b.startsAt).getTime() > now)
    .slice(0, 5)
    .map((b) => ({
      bookingId: b.id,
      title: b.title,
      startsAt: b.startsAt,
    }));

  const todayCount = todaySchedule.length;
  const workloadEstimateEn =
    todayCount === 0
      ? "Light day — room for new opportunities."
      : todayCount <= 2
        ? `Moderate load: ${todayCount} job(s) today.`
        : `Busy day: ${todayCount} jobs — protect travel buffers.`;
  const workloadEstimateAr =
    todayCount === 0
      ? "يوم خفيف — مجال لفرص جديدة."
      : todayCount <= 2
        ? `حمل متوسط: ${todayCount} عمل اليوم.`
        : `يوم مزدحم: ${todayCount} أعمال — احفظ وقت التنقل.`;

  const suggestedNextJobs = input.opportunities.slice(0, 3).map((o) => ({
    assignmentId: o.assignmentId,
    title: o.title,
    reasonEn: o.urgency === "emergency"
      ? "Urgent request near your coverage."
      : "Fits your open capacity.",
    reasonAr: o.urgency === "emergency"
      ? "طلب عاجل ضمن نطاقك."
      : "يناسب سعتك المتاحة.",
  }));

  const nextStart = upcomingJobs[0]?.startsAt ?? null;
  const suggestionsRaw = buildProviderSuggestions({
    freeSlotNearby: input.freeSlotNearby,
    missedOpportunities: input.missedOpportunities,
    nextJobStartsAt: nextStart,
  });

  const suggestions = await persistSuggestions({
    suggestions: suggestionsRaw,
    audience: "provider",
    providerId: input.providerId,
  });

  void emitAiLearningEvent({
    eventType: "assistant_shown",
    providerId: input.providerId,
    metadata: {
      audience: "provider",
      todayCount,
      opportunityCount: input.opportunities.length,
    },
  });

  const travelHints =
    upcomingJobs.length >= 2
      ? ["Cluster nearby jobs to reduce travel time.", "Leave a buffer before the next start."]
      : upcomingJobs.length === 1
        ? ["Plan route to the first job; arrive a few minutes early."]
        : ["Check the opportunity list while you have free capacity."];

  return {
    todaySchedule,
    upcomingJobs,
    workloadEstimateEn,
    workloadEstimateAr,
    suggestedNextJobs,
    customerSummaryEn: input.customerSummaryEn ?? null,
    customerSummaryAr: input.customerSummaryAr ?? null,
    conversationSummary: input.conversationSummary ?? null,
    missedOpportunities: input.missedOpportunities ?? 0,
    preparationNotes: input.preparationNotes ?? [],
    travelHints,
    suggestions,
  };
}
