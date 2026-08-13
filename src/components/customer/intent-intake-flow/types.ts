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

export type TargetProviderContext = {
  id: string;
  name: string;
  categoryId: string;
  categorySlug: string;
  categoryLabel: string;
  /** Prefill city when available (customer can still change). */
  cityId?: string | null;
};

export type IntentIntakeFlowProps = {
  initialIntent?: string;
  cities: CityOption[];
  loginHref: string;
  isAuthenticated: boolean;
  visionEnabled?: boolean;
  voiceEnabled?: boolean;
  /** Direct-search: skip category AI; lock category to this provider. */
  targetProvider?: TargetProviderContext | null;
  /**
   * Homepage "Publish a request" (`?mode=publish`) — land on category pick
   * instead of the free-text AI intent box. Categories should be preloaded.
   */
  startAtCategory?: boolean;
  /** Leaf categories for manual pick when skipping AI suggestion. */
  initialCategories?: CategoryOption[];
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
