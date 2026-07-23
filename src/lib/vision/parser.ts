/**
 * Parses and validates OpenAI Vision JSON into a typed VisionAnalysisPayload.
 * Rejects free-form / malformed responses — the app never receives raw model text.
 */

import { VISION_SERVICE_CATEGORIES } from "@/lib/vision/constants";
import type {
  VisionAnalysisPayload,
  VisionConfidenceLevel,
  VisionServiceCategory,
  VisionUrgency,
} from "@/lib/vision/types";

const CONFIDENCE: VisionConfidenceLevel[] = ["high", "medium", "low"];
const URGENCY: VisionUrgency[] = ["emergency", "high", "normal", "low"];
const CATEGORY_SET = new Set<string>(VISION_SERVICE_CATEGORIES);

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);
}

function asCategory(value: unknown): VisionServiceCategory {
  const raw = asString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (CATEGORY_SET.has(raw)) return raw as VisionServiceCategory;
  return "unsupported";
}

function asConfidence(value: unknown): VisionConfidenceLevel {
  const raw = asString(value).toLowerCase();
  return (CONFIDENCE as string[]).includes(raw) ? (raw as VisionConfidenceLevel) : "low";
}

function asUrgency(value: unknown, emergency: boolean): VisionUrgency {
  if (emergency) return "emergency";
  const raw = asString(value).toLowerCase();
  return (URGENCY as string[]).includes(raw) ? (raw as VisionUrgency) : "normal";
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Prefer fenced JSON if the model wraps it
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseVisionAnalysis(raw: string | unknown): VisionAnalysisPayload | null {
  const data = typeof raw === "string" ? extractJsonObject(raw) : raw;
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  const category = asCategory(obj.category);
  const emergency = Boolean(obj.emergency) || asUrgency(obj.urgency, false) === "emergency";
  const problem = asString(obj.problem);
  const summary = asString(obj.summary) || problem;

  if (category === "unsupported") {
    return {
      category: "unsupported",
      problem: problem || "unsupported",
      symptoms: asStringArray(obj.symptoms),
      visibleObjects: asStringArray(obj.visibleObjects ?? obj.visible_objects),
      possibleCause: asString(obj.possibleCause ?? obj.possible_cause) || null,
      urgency: "low",
      emergency: false,
      confidenceLevel: asConfidence(obj.confidenceLevel ?? obj.confidence_level),
      recommendedQuestions: asStringArray(obj.recommendedQuestions ?? obj.recommended_questions),
      summary: summary || "unsupported",
    };
  }

  if (!problem && !summary) return null;

  return {
    category,
    problem: problem || summary,
    symptoms: asStringArray(obj.symptoms),
    visibleObjects: asStringArray(obj.visibleObjects ?? obj.visible_objects),
    possibleCause: asString(obj.possibleCause ?? obj.possible_cause) || null,
    urgency: asUrgency(obj.urgency, emergency),
    emergency,
    confidenceLevel: asConfidence(obj.confidenceLevel ?? obj.confidence_level),
    recommendedQuestions: asStringArray(obj.recommendedQuestions ?? obj.recommended_questions),
    summary,
  };
}
