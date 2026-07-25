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
};
