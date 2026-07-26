/**
 * AI project plan — trade order + dependencies for multi-service jobs.
 */

import type { AiExecutionPlan } from "./types";

const TRADE_LABELS: Record<string, { en: string; ar: string; days: number }> = {
  plumbing: { en: "Plumbing", ar: "سباكة", days: 2 },
  electrical: { en: "Electrical", ar: "كهرباء", days: 1.5 },
  carpentry: { en: "Carpentry / drywall", ar: "نجارة / جبس", days: 2 },
  painting: { en: "Painting", ar: "دهان", days: 2 },
  hvac: { en: "HVAC", ar: "تكييف", days: 1 },
  locksmith: { en: "Locksmith", ar: "أقفال", days: 0.5 },
  cleaning: { en: "Cleaning", ar: "تنظيف", days: 1 },
  roofing: { en: "Roofing", ar: "أسطح", days: 2 },
};

/** Canonical renovation sequence — later trades depend on earlier ones. */
const DEFAULT_SEQUENCE = [
  "plumbing",
  "electrical",
  "hvac",
  "carpentry",
  "painting",
  "cleaning",
];

function labelFor(slug: string) {
  return (
    TRADE_LABELS[slug] ?? {
      en: slug.replace(/-/g, " "),
      ar: slug,
      days: 1.5,
    }
  );
}

/**
 * Build ordered execution plan with dependency edges.
 * Customer may later reorder via reorderProjectPackages.
 */
export function buildAiExecutionPlan(input: {
  primaryTrade: string;
  relatedTrades: string[];
  text?: string;
}): AiExecutionPlan {
  const all = [
    input.primaryTrade,
    ...input.relatedTrades.filter((t) => t !== input.primaryTrade),
  ];
  const unique = [...new Set(all.map((t) => t.toLowerCase()))];

  const rank = (slug: string) => {
    const i = DEFAULT_SEQUENCE.indexOf(slug);
    return i >= 0 ? i : 50 + slug.charCodeAt(0);
  };

  const sorted = [...unique].sort((a, b) => rank(a) - rank(b));

  // Water damage: plumbing first, then carpentry, then paint
  const text = input.text ?? "";
  if (/water damage|غرق|flood/i.test(text)) {
    const preferred = ["plumbing", "carpentry", "painting"].filter((t) =>
      unique.includes(t),
    );
    const rest = sorted.filter((t) => !preferred.includes(t));
    sorted.length = 0;
    sorted.push(...preferred, ...rest);
  }

  const ordered = sorted.map((tradeSlug, idx) => {
    const dependsOn = idx === 0 ? [] : [sorted[idx - 1]];
    const lab = labelFor(tradeSlug);
    return {
      tradeSlug,
      sortOrder: idx + 1,
      dependsOn,
      titleEn: lab.en,
      titleAr: lab.ar,
      estimatedDays: lab.days,
    };
  });

  const total = ordered.reduce((s, p) => s + p.estimatedDays, 0);

  return {
    trades: sorted,
    ordered,
    estimatedDaysMin: Math.max(1, Math.round(total * 0.85)),
    estimatedDaysMax: Math.max(2, Math.round(total * 1.35)),
    reasonEn:
      "Suggested sequence reduces rework: wet trades and rough-ins before finishing.",
    reasonAr:
      "التسلسل المقترح يقلل إعادة العمل: السباكة والتأسيس قبل التشطيب.",
  };
}

export function detectProjectKind(text: string): {
  isMulti: boolean;
  kind: "bathroom" | "kitchen" | "water_damage" | "generic" | "single";
} {
  if (/bathroom renovation|تجديد حمام/i.test(text)) {
    return { isMulti: true, kind: "bathroom" };
  }
  if (/kitchen renovation|تجديد مطبخ|مطبخ كامل|remodel/i.test(text)) {
    return { isMulti: true, kind: "kitchen" };
  }
  if (/water damage|غرق|flood|رطوبة عالية/i.test(text)) {
    return { isMulti: true, kind: "water_damage" };
  }
  return { isMulti: false, kind: "single" };
}
