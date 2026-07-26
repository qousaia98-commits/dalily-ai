/** AI Engine Phase 4 — Job intelligence types. */

export type JobComplexity = "simple" | "moderate" | "complex";

export type DurationEstimate = {
  minMinutes: number;
  typicalMinutes: number;
  maxMinutes: number;
  /** Human label e.g. "45–90 minutes" or "5–10 days". */
  labelEn: string;
  labelAr: string;
  unit: "minutes" | "hours" | "days";
};

export type PriceEstimate = {
  min: number;
  typical: number;
  max: number;
  currency: string;
  /** Always true — UI must not present as fixed prices. */
  isRangeOnly: true;
  disclaimerEn: string;
  disclaimerAr: string;
};

export type ServiceKnowledgeEntry = {
  serviceKey: string;
  categorySlug: string;
  subcategory: string | null;
  typicalProblems: string[];
  commonCauses: string[];
  requiredSkills: string[];
  typicalTools: string[];
  commonMaterials: string[];
  duration: DurationEstimate;
  complexity: JobComplexity;
  emergencyCapable: boolean;
  certifications: string[];
  price: PriceEstimate;
  relatedTrades: string[];
  matchKeywords: string[];
  workersTypical: number;
  followUpWork: string[];
};

export type JobAnalysis = {
  version: 4;
  serviceKey: string;
  categorySlug: string;
  subcategory: string | null;
  likelyRootCause: string;
  requiredWork: string[];
  estimatedDuration: DurationEstimate;
  estimatedDifficulty: JobComplexity;
  estimatedWorkers: number;
  potentialFollowUp: string[];
  tools: string[];
  materials: string[];
  price: PriceEstimate;
  relatedTrades: string[];
  multiService: boolean;
  emergencyCapable: boolean;
  certifications: string[];
  confidence: number;
  knowledgeSource: "catalog" | "rules" | "hybrid";
};

export type ProviderPrepSummary = {
  analysis: JobAnalysis;
  durationLabel: string;
  tools: string[];
  materials: string[];
  complexity: JobComplexity;
  priceRangeLabel: string;
  disclaimer: string;
  relatedTrades: string[];
  /** Phase 5 — optional vision enrichment. */
  vision?: {
    detectedObjects: string[];
    likelyDamage: string[];
    estimatedRisk: "low" | "medium" | "high";
    imageConfidence: number;
    contradiction: boolean;
  } | null;
};
