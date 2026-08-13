/**
 * Risk engine — modular weighted rules + optional ML layer.
 * Assists admins; never auto-suspends.
 */

import {
  FRAUD_SIGNAL_COLLECTORS,
  ML_RISK_COLLECTOR,
  type FraudRawSignals,
  type SignalCollector,
} from "@/lib/fraud/signals";
import { DEFAULT_RISK_RULES, type RuleWeight } from "@/lib/fraud/weights";
import {
  FRAUD_ML_LAYER_VERSION,
  FRAUD_MODEL_VERSION,
  scoreToRiskLevel,
  type FraudAutoAction,
  type RiskComputation,
  type RiskEntityType,
  type RiskSignalResult,
} from "@/lib/fraud/types";

export function computeRiskFromSignals(input: {
  entityType: RiskEntityType;
  entityId: string;
  raw: FraudRawSignals;
  rules?: RuleWeight[];
  collectors?: SignalCollector[];
  /** When true, include ML collector if mlRiskScore present. */
  includeMlLayer?: boolean;
}): RiskComputation {
  const rules = input.rules ?? DEFAULT_RISK_RULES;
  const ruleByKey = new Map(rules.map((r) => [r.ruleKey, r]));
  let collectors = input.collectors ?? FRAUD_SIGNAL_COLLECTORS;

  if (
    input.includeMlLayer !== false &&
    input.raw.mlRiskScore != null &&
    Number(input.raw.mlRiskScore) > 0
  ) {
    collectors = [...collectors, ML_RISK_COLLECTOR];
    if (!ruleByKey.has("ml_risk_model")) {
      ruleByKey.set("ml_risk_model", {
        ruleKey: "ml_risk_model",
        category: "ml",
        weight: 1.2,
        threshold: 0.5,
        enabled: true,
        mlReady: true,
        autoActions: ["require_manual_review", "escalate_to_admin"],
      });
    }
  }

  const signals: RiskSignalResult[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let mlContribution = 0;
  const triggeredRules: string[] = [];
  const actionVotes = new Map<FraudAutoAction, number>();

  for (const collector of collectors) {
    const rule = ruleByKey.get(collector.signalKey);
    if (!rule || !rule.enabled) continue;

    const computed = collector.computeNormalized(input.raw);
    const contribution = computed.normalizedValue * rule.weight;
    const triggered = computed.normalizedValue >= rule.threshold;
    const isMl = Boolean(computed.metadata?.ml);

    signals.push({
      signalKey: collector.signalKey,
      category: collector.category,
      rawValue: computed.rawValue,
      normalizedValue: computed.normalizedValue,
      weight: rule.weight,
      contribution,
      source: isMl ? "ml" : "rule",
      triggered,
      metadata: computed.metadata,
    });

    weightedSum += contribution;
    weightTotal += rule.weight;
    if (isMl) mlContribution += contribution;

    if (triggered) {
      triggeredRules.push(collector.signalKey);
      for (const action of rule.autoActions) {
        actionVotes.set(action, (actionVotes.get(action) ?? 0) + rule.weight);
      }
    }
  }

  const score01 = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const internalScore =
    Math.round(Math.max(0, Math.min(100, score01 * 100)) * 100) / 100;
  const riskLevel = scoreToRiskLevel(internalScore);

  let suggestedAction: FraudAutoAction | "none" = "none";
  let bestVote = 0;
  for (const [action, vote] of actionVotes) {
    if (vote > bestVote) {
      bestVote = vote;
      suggestedAction = action;
    }
  }
  // Hard safety: never permanent suspend via auto actions.
  if (suggestedAction === ("permanent_suspend" as FraudAutoAction)) {
    suggestedAction = "escalate_to_admin";
  }

  const confidence =
    Math.round(
      (0.4 + Math.min(0.5, triggeredRules.length * 0.08) + (mlContribution > 0 ? 0.1 : 0)) *
        1000,
    ) / 1000;

  const explanation = buildExplanation({
    riskLevel,
    triggeredRules,
    internalScore,
    suggestedAction,
    hasMl: mlContribution > 0,
  });

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    internalScore,
    riskLevel,
    confidence: Math.min(0.95, confidence),
    explanation,
    triggeredRules,
    suggestedAction,
    signals,
    mlContribution: Math.round(mlContribution * 1000) / 1000,
    modelVersion:
      mlContribution > 0
        ? `${FRAUD_MODEL_VERSION}+${FRAUD_ML_LAYER_VERSION}`
        : FRAUD_MODEL_VERSION,
  };
}

function buildExplanation(input: {
  riskLevel: string;
  triggeredRules: string[];
  internalScore: number;
  suggestedAction: string;
  hasMl: boolean;
}): string {
  if (input.triggeredRules.length === 0) {
    return `Internal risk ${input.riskLevel} (${input.internalScore}/100). No rules exceeded threshold.`;
  }
  const rules = input.triggeredRules.slice(0, 5).join(", ");
  const ml = input.hasMl ? " ML layer contributed an additional signal." : "";
  return `Internal risk ${input.riskLevel} (${input.internalScore}/100). Triggered: ${rules}. Suggested action: ${input.suggestedAction}.${ml}`;
}
