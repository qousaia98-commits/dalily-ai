import type { ManagedProvider } from "@/types/provider.types";
import { calculateBusinessHealth } from "@/lib/business/health-score";

export type GrowthTip = {
  id: string;
  titleKey: string;
  whyKey: string;
  href: string;
};

export function buildGrowthTips(provider: ManagedProvider, limit = 4): GrowthTip[] {
  const { suggestions } = calculateBusinessHealth(provider);
  const tips: GrowthTip[] = [];

  for (const item of suggestions) {
    const href =
      item.id === "verification"
        ? "/business/verification"
        : item.id === "gallery" || item.id === "logo" || item.id === "cover"
          ? "/business/gallery"
          : item.id === "categories"
            ? "/business/services"
            : "/business/profile";

    tips.push({
      id: item.id,
      titleKey: item.suggestionKey,
      whyKey: item.suggestionKey,
      href,
    });
  }

  return tips.slice(0, limit);
}
