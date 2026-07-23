import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";
import type { CategorySlug } from "@/lib/categories/types";

export type AdvisorClarifyingQuestion = {
  id: string;
  /** i18n key under search.advisor.questions.* */
  questionKey: string;
};

export type ServiceAdvisorInsight = {
  categorySlug: CategorySlug | null;
  categoryLabelKey: string | null;
  urgency: ProblemPriority | null;
  possibleIssueKey: string | null;
  clarifyingQuestions: AdvisorClarifyingQuestion[];
  problemId: ProblemId | null;
};

const ISSUE_BY_PROBLEM: Partial<Record<ProblemId, string>> = {
  ac_not_cooling: "coolingOrRefrigerant",
  water_leak: "pipeOrFixture",
  power_outage: "circuitOrSupply",
  appliance_leak: "sealOrHose",
  locked_out: "lockMechanism",
  vehicle_repair: "mechanicalOrElectrical",
  cleaning_need: "deepOrRoutine",
  photography_need: "eventOrPortrait",
};

const QUESTIONS_BY_PROBLEM: Partial<Record<ProblemId, AdvisorClarifyingQuestion[]>> = {
  ac_not_cooling: [
    { id: "ac_off", questionKey: "acCompletelyOff" },
    { id: "ac_leak", questionKey: "acWaterLeaking" },
    { id: "ac_unit", questionKey: "acIndoorOrOutdoor" },
  ],
  water_leak: [
    { id: "leak_active", questionKey: "leakStillRunning" },
    { id: "leak_where", questionKey: "leakLocation" },
  ],
  power_outage: [
    { id: "power_neighbors", questionKey: "powerNeighborsAffected" },
    { id: "power_breaker", questionKey: "powerBreakerTripped" },
  ],
  appliance_leak: [
    { id: "appliance_brand", questionKey: "applianceBrand" },
    { id: "appliance_noise", questionKey: "applianceNoise" },
  ],
};

/**
 * Rule-based Service Advisor — same contract a future LLM advisor can implement.
 */
export function analyzeServiceRequest(input: {
  problemId: ProblemId | null;
  priority: ProblemPriority | null;
  categorySlug: CategorySlug | null;
}): ServiceAdvisorInsight {
  const problemId = input.problemId;
  return {
    categorySlug: input.categorySlug,
    categoryLabelKey: input.categorySlug,
    urgency: input.priority,
    possibleIssueKey: problemId ? (ISSUE_BY_PROBLEM[problemId] ?? null) : null,
    clarifyingQuestions: problemId ? (QUESTIONS_BY_PROBLEM[problemId] ?? []) : [],
    problemId,
  };
}
