import type { ServiceCategory } from "@/lib/constants/categories";

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
  | "cleaning_need";

export type ProblemPriority = "emergency" | "high" | "normal" | "low";

export type DetectedProblem = {
  problemId: ProblemId;
  priority: ProblemPriority;
  category: ServiceCategory;
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
  categorySlug?: ServiceCategory;
  citySlug?: string;
  verifiedOnly?: boolean;
  locale?: string;
  userId?: string | null;
};

export type SearchEngineResult = {
  providers: import("@/types/search.types").ProviderListItem[];
  parsed: {
    problemId: ProblemId | null;
    priority: ProblemPriority | null;
    categorySlug: ServiceCategory | null;
    citySlug: string | null;
    textTerms: string;
  };
};

export const SEARCH_TOP_N = 3;
