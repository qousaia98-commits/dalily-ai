/**
 * Heuristic AI quality analysis — ML-ready shape.
 */

import type {
  QualityAiAnalysis,
  QualityCaseCategory,
  QualityCasePriority,
} from "@/lib/quality/types";
import { QUALITY_MODEL_VERSION } from "@/lib/quality/types";

const NEGATIVE =
  /\b(terrible|awful|scam|fraud|damage|broken|late|never arrived|rude|unsafe|نصب|تأخير|ضرر|سيء)\b/i;
const URGENT =
  /\b(urgent|asap|immediately|emergency|unsafe|danger|عاجل|فوري|خطر)\b/i;
const DAMAGE = /\b(damage|broken|ruined|leak|fire|ضرر|كسر|تسريب)\b/i;
const NOSHOW = /\b(no[- ]?show|never arrived|didn't come|لم يحضر|ما اجى)\b/i;
const LATE = /\b(late|delay|hours late|متأخر|تأخير)\b/i;
const COMM = /\b(no reply|ignored|ghosted|won't answer|ما بيرد|تجاهل)\b/i;

export function analyzeQualityCase(input: {
  caseId: string;
  title: string;
  description: string;
  category: QualityCaseCategory;
  priorCaseCountForPair?: number;
}): Omit<QualityAiAnalysis, "analyzedAt"> & { analyzedAt?: string } {
  const text = `${input.title}\n${input.description}`.trim();
  const lower = text.toLowerCase();

  let severity = 0.35;
  let urgency = 0.3;
  const topics: string[] = [];

  if (NEGATIVE.test(text)) {
    severity += 0.25;
    topics.push("negative_language");
  }
  if (URGENT.test(text)) {
    urgency += 0.35;
    topics.push("urgency");
  }
  if (DAMAGE.test(text)) {
    severity += 0.3;
    urgency += 0.2;
    topics.push("damage");
  }
  if (NOSHOW.test(text)) {
    severity += 0.2;
    urgency += 0.25;
    topics.push("no_show");
  }
  if (LATE.test(text)) {
    severity += 0.1;
    topics.push("late_arrival");
  }
  if (COMM.test(text)) {
    severity += 0.1;
    topics.push("communication");
  }

  const repeated =
    (input.priorCaseCountForPair ?? 0) >= 2 ||
    (input.priorCaseCountForPair ?? 0) >= 1 && severity > 0.6;

  if (repeated) {
    severity += 0.15;
    urgency += 0.1;
    topics.push("repeat_pattern");
  }

  severity = Math.min(1, Math.round(severity * 1000) / 1000);
  urgency = Math.min(1, Math.round(urgency * 1000) / 1000);

  const suggestedCategory = suggestCategory(lower, input.category);
  const suggestedPriority = suggestPriority(severity, urgency);
  const riskLevel =
    severity >= 0.85 || urgency >= 0.85
      ? "critical"
      : severity >= 0.65 || urgency >= 0.65
        ? "high"
        : severity >= 0.4
          ? "medium"
          : "low";

  const sentiment =
    severity >= 0.55 ? "negative" : severity >= 0.35 ? "mixed" : "neutral";

  return {
    caseId: input.caseId,
    sentiment,
    severity,
    urgency,
    riskLevel,
    suggestedCategory,
    suggestedPriority,
    suggestedResolution: suggestResolution(suggestedCategory, riskLevel),
    repeatedPattern: repeated,
    patternNotes: repeated
      ? "Repeated complaints detected for this customer–provider pair."
      : null,
    topics: [...new Set(topics)],
    modelVersion: QUALITY_MODEL_VERSION,
  };
}

function suggestCategory(
  text: string,
  fallback: QualityCaseCategory,
): QualityCaseCategory {
  if (DAMAGE.test(text)) return "damage_report";
  if (NOSHOW.test(text)) return "no_show";
  if (LATE.test(text)) return "late_arrival";
  if (COMM.test(text)) return "communication";
  if (/quality|poor work|incomplete|شغل سيء|ناقص/.test(text)) {
    return "service_quality";
  }
  if (/policy|abuse|harassment/.test(text)) return "policy_violation";
  return fallback;
}

function suggestPriority(
  severity: number,
  urgency: number,
): QualityCasePriority {
  const score = severity * 0.55 + urgency * 0.45;
  if (score >= 0.8) return "urgent";
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

function suggestResolution(
  category: QualityCaseCategory,
  risk: string,
): string {
  if (risk === "critical") {
    return "Escalate immediately, request evidence from both parties, and pause related payouts if applicable.";
  }
  switch (category) {
    case "no_show":
      return "Confirm booking timeline, request GPS/chat proof, offer rebooking or partial refund path.";
    case "damage_report":
      return "Collect photos of damage, review booking scope, mediate repair or compensation.";
    case "late_arrival":
      return "Review punctuality history; request apology and schedule adjustment.";
    case "communication":
      return "Ask provider to respond within SLA; monitor unread backlog.";
    case "service_quality":
      return "Request before/after photos; consider revisit or partial refund review.";
    default:
      return "Gather evidence from both parties and resolve with a clear written outcome.";
  }
}
