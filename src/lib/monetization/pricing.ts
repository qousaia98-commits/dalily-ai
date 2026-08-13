/**
 * Sprint 6 Phase 1 — AI lead unlock pricing.
 * Always clamps to admin min/max. Never mutates business data beyond price snapshot.
 */

import { getBillingSettings } from "./settings";
import type { LeadPricingFactors, LeadPricingResult } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Deterministic AI-style pricing from request factors + admin multipliers.
 */
export async function calculateLeadUnlockPrice(
  factors: LeadPricingFactors,
): Promise<LeadPricingResult> {
  const settings = await getBillingSettings();
  const multipliersApplied: Record<string, number> = {};

  let price = settings.baseLeadPriceUsd;
  multipliersApplied.base = 1;

  // Project value influence (soft): higher value → slightly higher unlock
  const valueFactor = clamp(
    factors.estimatedProjectValueUsd / 200,
    0.8,
    2.2,
  );
  price *= valueFactor;
  multipliersApplied.value = roundMoney(valueFactor);

  if (factors.isEmergency) {
    price *= settings.emergencyMultiplier;
    multipliersApplied.emergency = settings.emergencyMultiplier;
  } else if (factors.urgency === "high") {
    price *= settings.urgencyMultiplier;
    multipliersApplied.urgency = settings.urgencyMultiplier;
  }

  if (factors.isMultiService) {
    price *= settings.multiServiceMultiplier;
    multipliersApplied.multiService = settings.multiServiceMultiplier;
  }

  if (factors.complexity === "high") {
    price *= settings.complexityMultiplier;
    multipliersApplied.complexity = settings.complexityMultiplier;
  } else if (factors.complexity === "medium") {
    price *= 1 + (settings.complexityMultiplier - 1) * 0.5;
    multipliersApplied.complexity = roundMoney(
      1 + (settings.complexityMultiplier - 1) * 0.5,
    );
  }

  // Duration soft bump
  if (factors.estimatedDurationHours >= 8) {
    price *= 1.15;
    multipliersApplied.duration = 1.15;
  } else if (factors.estimatedDurationHours >= 4) {
    price *= 1.08;
    multipliersApplied.duration = 1.08;
  }

  if (factors.distanceKm != null && factors.distanceKm > 0) {
    const distMul =
      1 + Math.min(factors.distanceKm, 40) * settings.distanceMultiplierPerKm;
    price *= distMul;
    multipliersApplied.distance = roundMoney(distMul);
  }

  if (factors.demandLevel === "high") {
    price *= settings.demandMultiplier;
    multipliersApplied.demand = settings.demandMultiplier;
  }

  const catSlug = factors.categorySlug?.toLowerCase() ?? "";
  if (catSlug && settings.categoryMultipliers[catSlug]) {
    const m = Number(settings.categoryMultipliers[catSlug]);
    if (Number.isFinite(m) && m > 0) {
      price *= m;
      multipliersApplied.category = m;
    }
  }

  const finalPriceUsd = roundMoney(
    clamp(price, settings.minLeadPriceUsd, settings.maxLeadPriceUsd),
  );

  // Score 0–1 reflecting how far into the band we landed
  const span = settings.maxLeadPriceUsd - settings.minLeadPriceUsd || 1;
  const aiScore = roundMoney(
    clamp((finalPriceUsd - settings.minLeadPriceUsd) / span, 0, 1),
  );

  const potentialRevenueUsd = roundMoney(
    Math.max(factors.estimatedProjectValueUsd * 0.85, finalPriceUsd * 8),
  );

  const explanationEn = buildExplanationEn({
    finalPriceUsd,
    factors,
    multipliersApplied,
    min: settings.minLeadPriceUsd,
    max: settings.maxLeadPriceUsd,
  });
  const explanationAr = buildExplanationAr({
    finalPriceUsd,
    factors,
    multipliersApplied,
    min: settings.minLeadPriceUsd,
    max: settings.maxLeadPriceUsd,
  });

  return {
    aiScore,
    basePriceUsd: settings.baseLeadPriceUsd,
    finalPriceUsd,
    currency: settings.currency,
    factors: { ...factors, multipliersApplied },
    explanationEn,
    explanationAr,
    estimatedProjectValueUsd: roundMoney(factors.estimatedProjectValueUsd),
    estimatedDurationHours: factors.estimatedDurationHours,
    potentialRevenueUsd,
  };
}

function buildExplanationEn(input: {
  finalPriceUsd: number;
  factors: LeadPricingFactors;
  multipliersApplied: Record<string, number>;
  min: number;
  max: number;
}): string {
  const bits: string[] = [
    `Unlock price $${input.finalPriceUsd.toFixed(2)} (band $${input.min}–$${input.max}).`,
  ];
  if (input.factors.isEmergency) bits.push("Emergency premium applied.");
  else if (input.factors.urgency === "high") bits.push("High urgency adjustment.");
  if (input.factors.isMultiService) bits.push("Multi-service project.");
  if (input.factors.complexity !== "low") {
    bits.push(`${input.factors.complexity} complexity.`);
  }
  bits.push(
    `Est. project value ~$${input.factors.estimatedProjectValueUsd.toFixed(0)}, ~${input.factors.estimatedDurationHours}h.`,
  );
  return bits.join(" ");
}

function buildExplanationAr(input: {
  finalPriceUsd: number;
  factors: LeadPricingFactors;
  multipliersApplied: Record<string, number>;
  min: number;
  max: number;
}): string {
  const bits: string[] = [
    `سعر فتح الطلب $${input.finalPriceUsd.toFixed(2)} (نطاق $${input.min}–$${input.max}).`,
  ];
  if (input.factors.isEmergency) bits.push("تم تطبيق علاوة الطوارئ.");
  else if (input.factors.urgency === "high") bits.push("تعديل بسبب الاستعجال.");
  if (input.factors.isMultiService) bits.push("مشروع متعدد الخدمات.");
  if (input.factors.complexity !== "low") {
    bits.push(`تعقيد ${input.factors.complexity}.`);
  }
  bits.push(
    `قيمة تقديرية ~$${input.factors.estimatedProjectValueUsd.toFixed(0)}، مدة ~${input.factors.estimatedDurationHours} ساعة.`,
  );
  return bits.join(" ");
}
