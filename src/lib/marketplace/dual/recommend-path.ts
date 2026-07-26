/**
 * Recommend publish-request vs find-provider path from free-text intent.
 * Lightweight heuristics aligned with recommendWorkflow strategies.
 */

import type { MarketplacePathRecommendation } from "./types";

const EMERGENCY_RE =
  /\b(emergency|urgent|asap|now|leak|flood|fire|غاز|طارئ|فوري|حريق|تسريب)\b/i;
const RENOVATION_RE =
  /\b(renovat|remodel|whole\s*house|apartment|kitchen\s*remodel|تجديد|ترميم|شقة|منزل كامل)\b/i;
const INSTALL_RE =
  /\b(install|installation|new\s+ac|mount|تركيب|تثبيت)\b/i;
const SIMPLE_REPAIR_RE =
  /\b(light\s*switch|bulb|faucet|tap|door\s*lock|socket|outlet|مفتاح|لمبة|حنفية|قفل|فيشة)\b/i;

export function recommendMarketplacePath(
  intentText: string,
): MarketplacePathRecommendation {
  const text = intentText.trim();
  if (text.length < 4) {
    return {
      version: 1,
      path: "publish",
      confidence: 0.45,
      reasonKey: "dual.recommend.default",
      reasonEn: "Describe the job a bit more — or choose how you want to start.",
      reasonAr: "صف المشكلة أكثر قليلاً — أو اختر كيف تريد البدء.",
      strategy: null,
    };
  }

  if (EMERGENCY_RE.test(text)) {
    return {
      version: 1,
      path: "find",
      confidence: 0.9,
      reasonKey: "dual.recommend.emergency",
      reasonEn: "Urgent issue — find an available provider nearby right away.",
      reasonAr: "مشكلة عاجلة — ابحث عن مزود متاح قريب فوراً.",
      strategy: "emergency_dispatch",
    };
  }

  if (RENOVATION_RE.test(text) || INSTALL_RE.test(text)) {
    return {
      version: 1,
      path: "publish",
      confidence: 0.88,
      reasonKey: "dual.recommend.complex",
      reasonEn: "Larger job — publish a request to collect multiple offers.",
      reasonAr: "عمل أكبر — انشر طلباً لاستلام عدة عروض.",
      strategy: "collect_offers",
    };
  }

  if (SIMPLE_REPAIR_RE.test(text) || text.length < 40) {
    return {
      version: 1,
      path: "find",
      confidence: 0.82,
      reasonKey: "dual.recommend.simple",
      reasonEn: "Small repair — find a provider directly and contact them.",
      reasonAr: "إصلاح بسيط — ابحث عن مزود مباشرة وتواصل معه.",
      strategy: "direct_contact",
    };
  }

  return {
    version: 1,
    path: "publish",
    confidence: 0.7,
    reasonKey: "dual.recommend.offers",
    reasonEn: "Publish your request so providers can send competing offers.",
    reasonAr: "انشر طلبك ليتمكن المزودون من إرسال عروض متنافسة.",
    strategy: "collect_offers",
  };
}

export function pathFromWorkflowStrategy(
  strategy: string | null | undefined,
): "publish" | "find" {
  if (
    strategy === "direct_contact" ||
    strategy === "emergency_dispatch" ||
    strategy === "guided_diagnosis"
  ) {
    return "find";
  }
  return "publish";
}
