export type IntentUrgency = "emergency" | "normal";

export type CategorySuggestion = {
  categoryId: string;
  categorySlug: string;
  labelEn: string;
  labelAr: string;
  confidence: number;
  hypothesizedUrgency: IntentUrgency;
  problemId: string | null;
};

export type PublishIntentInput = {
  intentText: string;
  categoryId: string;
  cityId: string;
  urgency: IntentUrgency;
  locationText?: string;
  /** AI suggestion the user saw (for feedback loop). */
  suggestedCategoryId?: string;
  suggestedCategorySlug?: string;
  suggestedConfidence?: number;
  suggestedUrgency?: "critical" | "high" | "medium" | "low";
  suggestedWorkflow?: string;
  /**
   * Direct-search: assign only this provider (skip broadcast matching).
   * Requires DIRECT_SEARCH_V1 + MATCHING_V2.
   */
  targetProviderId?: string;
};
