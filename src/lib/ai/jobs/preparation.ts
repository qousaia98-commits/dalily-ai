import type { JobAnalysis, ProviderPrepSummary } from "@/lib/ai/jobs/types";

/**
 * Provider-facing preparation summary before accepting / offering.
 */
export function buildProviderPrepSummary(
  analysis: JobAnalysis,
  locale: "en" | "ar" = "en",
  extras?: {
    visionTools?: string[];
    visionMaterials?: string[];
    vision?: ProviderPrepSummary["vision"];
  },
): ProviderPrepSummary {
  const durationLabel =
    locale === "ar"
      ? analysis.estimatedDuration.labelAr
      : analysis.estimatedDuration.labelEn;

  const priceRangeLabel = `${formatMoney(analysis.price.min, analysis.price.currency)} – ${formatMoney(analysis.price.max, analysis.price.currency)}`;

  const disclaimer =
    locale === "ar" ? analysis.price.disclaimerAr : analysis.price.disclaimerEn;

  return {
    analysis,
    durationLabel,
    tools: mergeUnique(analysis.tools, extras?.visionTools),
    materials: mergeUnique(analysis.materials, extras?.visionMaterials),
    complexity: analysis.estimatedDifficulty,
    priceRangeLabel,
    disclaimer,
    relatedTrades: analysis.multiService ? analysis.relatedTrades : [],
    vision: extras?.vision ?? null,
  };
}

function mergeUnique(base: string[], extra?: string[]): string[] {
  if (!extra?.length) return base;
  const set = new Set(base);
  for (const item of extra) set.add(item);
  return Array.from(set);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
