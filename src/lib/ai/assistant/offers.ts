/**
 * Balanced offer comparison — never recommend on price alone.
 */

import type { MarketplaceOfferView } from "@/domains/offer/types";
import type {
  OfferCompareDimension,
  OfferCompareItem,
  OfferComparisonResult,
} from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

const WEIGHTS: Record<OfferCompareDimension, number> = {
  price: 0.2,
  availability: 0.18,
  rating: 0.2,
  distance: 0.12,
  experience: 0.15,
  response_speed: 0.15,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function hoursSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function scoreOffers(offers: MarketplaceOfferView[]): OfferCompareItem[] {
  if (offers.length === 0) return [];

  const prices = offers.map((o) => o.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSpan = Math.max(1, maxPrice - minPrice);

  return offers.map((o) => {
    const priceScore = clamp01(1 - (o.price - minPrice) / priceSpan);
    const ratingScore = clamp01((o.ratingAvg ?? 3.5) / 5);
    const verified = o.verificationStatus === "approved" || o.verificationStatus === "verified";
    const experienceScore = verified ? 0.85 : 0.45;
    const responseHours = hoursSince(o.createdAt);
    const responseScore = clamp01(1 - responseHours / 48);
    const availabilityScore = o.etaText ? 0.75 : 0.45;
    // Distance placeholder — no geo on offer yet; neutral mid score
    const distanceScore = 0.55;

    const scores: Record<OfferCompareDimension, number> = {
      price: priceScore,
      availability: availabilityScore,
      rating: ratingScore,
      distance: distanceScore,
      experience: experienceScore,
      response_speed: responseScore,
    };

    let overall = 0;
    for (const [dim, w] of Object.entries(WEIGHTS) as Array<
      [OfferCompareDimension, number]
    >) {
      overall += scores[dim] * w;
    }

    return {
      offerId: o.id,
      providerName: o.providerName ?? "Business",
      price: o.price,
      currency: o.currency,
      ratingAvg: o.ratingAvg,
      etaText: o.etaText,
      verified,
      responseHours: Math.round(responseHours * 10) / 10,
      scores,
      overallScore: Math.round(overall * 1000) / 1000,
    };
  });
}

function buildExplanation(items: OfferCompareItem[]): {
  winnerOfferId: string | null;
  explanationEn: string;
  explanationAr: string;
  reasonsEn: string[];
  reasonsAr: string[];
} {
  if (items.length === 0) {
    return {
      winnerOfferId: null,
      explanationEn: "No offers to compare yet.",
      explanationAr: "لا توجد عروض للمقارنة بعد.",
      reasonsEn: [],
      reasonsAr: [],
    };
  }

  const ranked = [...items].sort((a, b) => b.overallScore - a.overallScore);
  const best = ranked[0]!;
  const cheapest = [...items].sort((a, b) => a.price - b.price)[0]!;

  const reasonsEn: string[] = [];
  const reasonsAr: string[] = [];

  if (best.verified) {
    reasonsEn.push(`${best.providerName} is verified.`);
    reasonsAr.push(`${best.providerName} موثّق.`);
  }
  if (best.ratingAvg != null && best.ratingAvg >= 4) {
    reasonsEn.push(`Strong rating (${best.ratingAvg.toFixed(1)}/5).`);
    reasonsAr.push(`تقييم قوي (${best.ratingAvg.toFixed(1)}/5).`);
  }
  if (best.etaText) {
    reasonsEn.push(`Clear availability: ${best.etaText}.`);
    reasonsAr.push(`توفر واضح: ${best.etaText}.`);
  }
  if (best.responseHours != null && best.responseHours <= 6) {
    reasonsEn.push("Responded quickly.");
    reasonsAr.push("استجاب بسرعة.");
  }
  if (best.offerId === cheapest.offerId) {
    reasonsEn.push("Also among the more affordable options — not the only reason.");
    reasonsAr.push("من الخيارات الأوفر أيضاً — وليس السبب الوحيد.");
  } else {
    reasonsEn.push(
      `Not the cheapest (${cheapest.providerName} is lower) — balance of quality and fit matters more.`,
    );
    reasonsAr.push(
      `ليس الأرخص (${cheapest.providerName} أقل سعراً) — التوازن أهم من السعر وحده.`,
    );
  }

  return {
    winnerOfferId: best.offerId,
    explanationEn: `Best overall fit: ${best.providerName}. We weighed rating, verification, response speed, availability, and price together — never price alone.`,
    explanationAr: `الأنسب إجمالاً: ${best.providerName}. وزنّا التقييم والتوثيق وسرعة الرد والتوفر والسعر معاً — وليس السعر وحده.`,
    reasonsEn,
    reasonsAr,
  };
}

export function compareOffers(
  offers: MarketplaceOfferView[],
): OfferComparisonResult {
  const items = scoreOffers(offers);
  const expl = buildExplanation(items);
  return {
    version: 7,
    items: items.sort((a, b) => b.overallScore - a.overallScore),
    ...expl,
  };
}

export async function compareAndStoreOffers(input: {
  serviceRequestId: string;
  offers: MarketplaceOfferView[];
}): Promise<OfferComparisonResult> {
  const comparison = compareOffers(input.offers);
  try {
    const admin = createAdminClient();
    await admin.from("ai_offer_comparisons").insert({
      service_request_id: input.serviceRequestId,
      comparison: comparison as unknown as Json,
      offer_ids: input.offers.map((o) => o.id),
    } as never);

    void emitAiLearningEvent({
      eventType: "assistant_offer_compared",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        offerCount: input.offers.length,
        winnerOfferId: comparison.winnerOfferId,
      },
    });
  } catch {
    // best-effort persist
  }
  return comparison;
}
