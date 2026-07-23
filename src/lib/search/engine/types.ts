import type { CategorySlug } from "@/lib/categories/types";

/**
 * Canonical problem identifier — language-agnostic.
 * EN and AR phrases map to the same ProblemId.
 */
export type ProblemId =
  | "water_leak"
  | "power_outage"
  | "ac_not_cooling"
  | "locked_out"
  | "appliance_leak"
  | "medical_need"
  | "legal_need"
  | "vehicle_repair"
  | "cleaning_need"
  | "dental_need"
  | "pharmacy_need"
  | "tutoring_need"
  | "restaurant_need"
  | "it_support_need"
  | "photography_need";

export type ProblemPriority = "emergency" | "high" | "normal" | "low";

export type DetectedProblem = {
  problemId: ProblemId;
  priority: ProblemPriority;
  category: CategorySlug;
  confidence: number;
};

export type ParsedUserQuery = {
  raw: string;
  normalized: string;
  problem: DetectedProblem | null;
  citySlug: string | null;
  textTerms: string;
};

export type SearchEngineInput = {
  query?: string;
  /** Explicit filter overrides detected category */
  categorySlug?: CategorySlug;
  /** Filter all leaf categories under a group */
  groupSlug?: CategorySlug;
  citySlug?: string;
  verifiedOnly?: boolean;
  locale?: string;
  userId?: string | null;
  /** Ephemeral user location — never permanently stored */
  userLat?: number | null;
  userLng?: number | null;
  /** Radius in km, or "city" for entire city. Omit to use dynamic radius. */
  nearbyRadius?: number | "city" | null;
  /** When true (default), apply adaptive radius from problem/category */
  useDynamicRadius?: boolean;
  sort?: import("@/lib/geo/distance").SearchSort;
};

export type SearchEngineResult = {
  providers: import("@/types/search.types").ProviderListItem[];
  parsed: {
    problemId: ProblemId | null;
    priority: ProblemPriority | null;
    categorySlug: CategorySlug | null;
    groupSlug: CategorySlug | null;
    citySlug: string | null;
    textTerms: string;
  };
  nearby?: {
    active: boolean;
    radiusKm: number | "city" | null;
    hasUserLocation: boolean;
    /** True when radius came from Smart Match policy */
    dynamic?: boolean;
  };
  advisor?: import("@/lib/search/smart-match/advisor").ServiceAdvisorInsight | null;
};

export const SEARCH_TOP_N = 12;
