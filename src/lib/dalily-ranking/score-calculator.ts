import {
  DALILY_SCORE_COMPONENT_KEYS,
  DALILY_SMART_MATCH_BLEND,
  getActiveWeights,
  type DalilyWeightMap,
} from "@/lib/dalily-ranking/weights";
import { computeAllComponents } from "@/lib/dalily-ranking/score-components";
import type {
  DalilyComponentScores,
  DalilyScoreBreakdown,
  ScoreCalculatorInput,
} from "@/lib/dalily-ranking/types";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function combineComponentScores(
  components: DalilyComponentScores,
  weights: DalilyWeightMap,
): { overall01: number; weighted: DalilyComponentScores } {
  const weighted = { ...components };
  let sum = 0;
  for (const key of DALILY_SCORE_COMPONENT_KEYS) {
    weighted[key] = components[key] * weights[key];
    sum += weighted[key];
  }
  return { overall01: clamp01(sum), weighted };
}

/**
 * Pure score calculator — server-side only.
 */
export function calculateDalilyScore(
  input: ScoreCalculatorInput,
  options?: {
    weights?: Partial<DalilyWeightMap> | null;
    smartMatchScore?: number | null;
    blendWithSmartMatch?: boolean;
  },
): DalilyScoreBreakdown {
  const weights = getActiveWeights(options?.weights);
  const components = computeAllComponents(input);
  const { overall01, weighted } = combineComponentScores(components, weights);
  const smart = options?.smartMatchScore != null ? clamp01(options.smartMatchScore) : null;

  let finalScore = overall01;
  if (options?.blendWithSmartMatch !== false && smart != null) {
    finalScore = clamp01(
      DALILY_SMART_MATCH_BLEND.dalily * overall01 +
        DALILY_SMART_MATCH_BLEND.smartMatch * smart,
    );
  }

  return {
    providerId: input.providerId,
    overall: Math.round(overall01 * 100),
    components,
    weighted,
    weights,
    smartMatchScore: smart,
    finalScore,
    computedAt: new Date().toISOString(),
  };
}
