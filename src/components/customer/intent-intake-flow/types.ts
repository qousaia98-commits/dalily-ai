import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import type { IntentVoiceInsight } from "@/components/customer/intent-voice-capture";

export type CityOption = { id: string; slug: string; label: string };
export type CategoryOption = { id: string; slug: string; label: string };

export type Step =
  | "intent"
  | "confirm"
  | "category"
  | "clarify"
  | "photos"
  | "location"
  | "urgency"
  | "publish";

export type VisionInsightState = {
  analysisId: string | null;
  summaryEn: string;
  summaryAr: string;
  contradiction: boolean;
  confirmed: boolean | null;
};

export type IntentIntakeFlowProps = {
  initialIntent?: string;
  cities: CityOption[];
  loginHref: string;
  isAuthenticated: boolean;
  visionEnabled?: boolean;
  voiceEnabled?: boolean;
};

export type DecisionQuestions = {
  questions?: Array<{ id: string; promptKey: string }>;
  urgency?: string;
  workflow?: { strategy?: string };
  completeness?: { score?: number };
  marketplaceUrgency?: IntentUrgency;
} | null;

export type {
  CategorySuggestion,
  IntentUrgency,
  IntentVoiceInsight,
};
