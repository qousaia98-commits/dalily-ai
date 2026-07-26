import type { AiComplexity, AiServiceType, AiUrgencyLevel } from "@/lib/ai/decision/types";
import { clamp01 } from "@/lib/ai/types";

const CRITICAL_PATTERNS =
  /flood|flooding|غرق|طوفان|ماء يملأ|ماء عم يغرق|gas leak|تسرب غاز|sparks?|شرر|حريق|fire|smoke|دخان|burning smell|ريحة حريق/i;

const HIGH_PATTERNS =
  /no (power|electricity)|بلا كهربا|ما في كهربا|انقطاع كهربا|locked out|محبوس|برّا البيت|water (still )?leak|عم يسرب|يسرب الآن|toilet overflow|طفح|emergency|طارئ|عاجل جدا/i;

const LOW_PATTERNS =
  /paint|طلاء|دهان|bedroom|غرفة نوم|cosmetic|تحسين|quote only|تسعيرة فقط|estimate|معاينة فقط|renovation plan|تجديد/i;

/**
 * Rule-based urgency: critical → high → medium → low.
 * Returns level + 0–1 score for ranking weight.
 */
export function detectUrgency(input: {
  text: string;
  categorySlug?: string | null;
  problemPriority?: string | null;
}): { level: AiUrgencyLevel; score: number } {
  const text = input.text;

  if (CRITICAL_PATTERNS.test(text)) {
    return { level: "critical", score: 1 };
  }
  if (
    input.problemPriority === "emergency" ||
    HIGH_PATTERNS.test(text) ||
    (input.categorySlug === "locksmith" && /locked|محبوس|برّا/i.test(text))
  ) {
    return { level: "high", score: 0.82 };
  }
  if (LOW_PATTERNS.test(text) || input.categorySlug === "painting") {
    // Painting default low unless emergency cues already matched above.
    if (!/urgent|طارئ|leak|غرق/i.test(text)) {
      return { level: "low", score: 0.25 };
    }
  }

  // Category defaults
  if (input.categorySlug === "plumbing" && /leak|تسرب|سرب/i.test(text)) {
    return { level: "high", score: 0.75 };
  }
  if (input.categorySlug === "electrical" && /outage|كهربا|فيوز/i.test(text)) {
    return { level: "high", score: 0.78 };
  }

  return { level: "medium", score: 0.5 };
}

export function urgencyToMarketplace(
  level: AiUrgencyLevel,
): "emergency" | "normal" {
  return level === "critical" || level === "high" ? "emergency" : "normal";
}

export function detectComplexity(input: {
  text: string;
  categorySlug?: string | null;
}): AiComplexity {
  const t = input.text;
  if (/renovation|تجديد|remodel|full house|شقة كاملة|multiple rooms|غرف متعددة/i.test(t)) {
    return "complex";
  }
  if (/install|تركيب|replace|تبديل|rewire|تمديد|several|عدة/i.test(t)) {
    return "moderate";
  }
  return "simple";
}

export function detectServiceType(input: {
  text: string;
  urgency: AiUrgencyLevel;
  complexity: AiComplexity;
}): AiServiceType {
  const t = input.text;
  if (input.urgency === "critical") return "emergency_response";
  if (/renovation|تجديد|remodel/i.test(t) || input.complexity === "complex") {
    return "renovation";
  }
  if (/install|تركيب|mount/i.test(t)) return "install";
  if (/inspect|معاينة|check|فحص|diagnose/i.test(t)) return "inspection";
  if (/maintenance|صيانة دورية|service/i.test(t)) return "maintenance";
  if (/repair|إصلاح|عطل|broken|خربان/i.test(t)) return "repair";
  return "other";
}

export function detectSubcategory(input: {
  text: string;
  categorySlug: string;
}): string | null {
  const t = input.text.toLowerCase();
  const map: Record<string, Array<[RegExp, string]>> = {
    plumbing: [
      [/toilet|مرحاض|تواليت/, "toilet"],
      [/kitchen|مطبخ|مجلى|sink/, "kitchen"],
      [/pipe|أنبوب|ماسورة/, "pipe"],
      [/leak|تسرب|سرب|flood/, "leak"],
      [/heater|سخان/, "water_heater"],
    ],
    electrical: [
      [/outage|power|كهربا|انقطاع/, "power_outage"],
      [/fuse|فيوز|قاطع/, "fuse"],
      [/outlet|فيش|مقبس/, "outlet"],
      [/light|إنارة|لمبة/, "lighting"],
      [/spark|شرر|حريق/, "safety"],
    ],
    hvac: [
      [/not cool|ما بيبرد|بدون تبريد/, "not_cooling"],
      [/noise|صوت/, "noise"],
      [/leak|يسرب ماء/, "drain_leak"],
    ],
    locksmith: [
      [/locked out|محبوس|برّا/, "lockout"],
      [/broken lock|قفل مكسور/, "broken_lock"],
      [/key lost|مفتاح ضايع/, "lost_key"],
    ],
    painting: [
      [/indoor|داخلي|غرفة/, "indoor"],
      [/outdoor|خارجي|واجهة/, "outdoor"],
    ],
    carpentry: [
      [/door|باب/, "door"],
      [/cabinet|خزانة|مطبخ/, "cabinet"],
    ],
  };

  const rules = map[input.categorySlug];
  if (!rules) return null;
  for (const [re, sub] of rules) {
    if (re.test(t)) return sub;
  }
  return null;
}

/** Soft weight for provider ranking from urgency (0–1). */
export function urgencyRankingBoost(level: AiUrgencyLevel): number {
  switch (level) {
    case "critical":
      return 1;
    case "high":
      return 0.75;
    case "medium":
      return 0.35;
    case "low":
      return 0.1;
  }
}

export function blendConfidence(...parts: number[]): number {
  if (parts.length === 0) return 0;
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  return clamp01(avg);
}
