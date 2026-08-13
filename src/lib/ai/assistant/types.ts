/** AI Engine Phase 7 — Personal Assistant types. */

export type AssistantAudience = "customer" | "provider" | "admin";

export type AssistantJobPhase =
  | "intake"
  | "matching"
  | "offers"
  | "unlock"
  | "chat"
  | "appointment"
  | "in_progress"
  | "completed"
  | "review";

export type ConfirmedFacts = {
  categorySlug?: string | null;
  urgency?: string | null;
  cityId?: string | null;
  locationText?: string | null;
  hasPhoto?: boolean;
  problemSummary?: string | null;
  addressShared?: boolean;
  appointmentAt?: string | null;
  selectedOfferId?: string | null;
  materialsNoted?: string[];
  questionsAnswered?: string[];
};

export type AssistantContext = {
  id?: string;
  serviceRequestId: string | null;
  bookingId?: string | null;
  conversationId?: string | null;
  audience: AssistantAudience;
  phase: AssistantJobPhase;
  confirmedFacts: ConfirmedFacts;
  askedQuestions: string[];
  lastSummary?: ConversationSummary | null;
};

export type ConversationSummary = {
  version: 7;
  audience: AssistantAudience;
  headlineEn: string;
  headlineAr: string;
  bulletsEn: string[];
  bulletsAr: string[];
  openItemsEn: string[];
  openItemsAr: string[];
  sentiment: "positive" | "neutral" | "tense";
  messageCount: number;
};

export type OfferCompareDimension =
  | "price"
  | "availability"
  | "rating"
  | "distance"
  | "experience"
  | "response_speed";

export type OfferCompareItem = {
  offerId: string;
  providerId: string;
  providerName: string;
  price: number;
  currency: string;
  ratingAvg: number | null;
  etaText: string | null;
  verified: boolean;
  responseHours: number | null;
  scores: Record<OfferCompareDimension, number>;
  overallScore: number;
};

export type OfferComparisonResult = {
  version: 7;
  items: OfferCompareItem[];
  winnerOfferId: string | null;
  explanationEn: string;
  explanationAr: string;
  /** Never price-only — lists balanced reasons. */
  reasonsEn: string[];
  reasonsAr: string[];
};

export type AppointmentBriefing = {
  version: 7;
  problemSummary: string;
  addressHint: string | null;
  preparation: string[];
  estimatedDuration: string | null;
  suggestedMaterials: string[];
  specialNotes: string[];
  startsAt: string | null;
  reminderEn: string;
  reminderAr: string;
};

export type AfterJobAssist = {
  version: 7;
  jobSummaryEn: string;
  jobSummaryAr: string;
  askReview: boolean;
  followUpWork: string[];
  maintenanceTips: string[];
};

export type ProactiveSuggestionType =
  | "missing_photo"
  | "incomplete_request"
  | "customer_no_response"
  | "appointment_soon"
  | "nearby_slot"
  | "follow_up_service"
  | "missed_opportunity"
  | "upload_reminder"
  | "review_request";

export type ProactiveSuggestion = {
  id?: string;
  type: ProactiveSuggestionType;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  actionKey?: string | null;
  priority: number;
  payload?: Record<string, unknown>;
};

export type CustomerAssistantView = {
  phase: AssistantJobPhase;
  stepExplanationEn: string;
  stepExplanationAr: string;
  nextActionEn: string;
  nextActionAr: string;
  missingInfo: string[];
  suggestions: ProactiveSuggestion[];
  offerComparison: OfferComparisonResult | null;
  appointment: AppointmentBriefing | null;
  afterJob: AfterJobAssist | null;
  context: AssistantContext;
};

export type ProviderAssistantView = {
  todaySchedule: Array<{
    bookingId: string;
    title: string;
    startsAt: string;
    endsAt: string | null;
  }>;
  upcomingJobs: Array<{
    bookingId: string;
    title: string;
    startsAt: string;
  }>;
  workloadEstimateEn: string;
  workloadEstimateAr: string;
  suggestedNextJobs: Array<{
    assignmentId: string;
    title: string;
    reasonEn: string;
    reasonAr: string;
  }>;
  customerSummaryEn: string | null;
  customerSummaryAr: string | null;
  conversationSummary: ConversationSummary | null;
  missedOpportunities: number;
  preparationNotes: string[];
  travelHints: string[];
  suggestions: ProactiveSuggestion[];
};
