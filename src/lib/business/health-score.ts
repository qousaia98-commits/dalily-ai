import type { ManagedProvider } from "@/types/provider.types";

export type HealthChecklistItem = {
  id: string;
  done: boolean;
  weight: number;
  suggestionKey: string;
};

export type BusinessHealthResult = {
  score: number;
  items: HealthChecklistItem[];
  suggestions: HealthChecklistItem[];
};

/**
 * Business health for growth UI.
 * Core trust/contact/location dominate — media is a small optional boost.
 */
export function calculateBusinessHealth(provider: ManagedProvider): BusinessHealthResult {
  const configuredHours = provider.workingHours.filter(
    (h) => h.isClosed || (h.opensAt && h.closesAt),
  ).length;

  const items: HealthChecklistItem[] = [
    {
      id: "verification",
      done:
        provider.verificationStatus === "verified" ||
        provider.verificationStatus === "partially_verified",
      weight: 18,
      suggestionKey: "verification",
    },
    {
      id: "description",
      done: Boolean(provider.about?.ar?.trim() || provider.about?.en?.trim()),
      weight: 14,
      suggestionKey: "description",
    },
    {
      id: "phone",
      done: Boolean(provider.phone?.trim()),
      weight: 12,
      suggestionKey: "phone",
    },
    {
      id: "whatsapp",
      done: Boolean(provider.whatsapp?.trim()),
      weight: 10,
      suggestionKey: "whatsapp",
    },
    {
      id: "location",
      done: Boolean(provider.cityId),
      weight: 10,
      suggestionKey: "location",
    },
    {
      id: "categories",
      done: Boolean(provider.categoryId) && provider.services.length > 0,
      weight: 10,
      suggestionKey: "categories",
    },
    {
      id: "hours",
      done: configuredHours >= 5,
      weight: 8,
      suggestionKey: "hours",
    },
    {
      id: "logo",
      done: Boolean(provider.avatarImageId),
      weight: 6,
      suggestionKey: "logo",
    },
    {
      id: "cover",
      done: Boolean(provider.coverImageId),
      weight: 5,
      suggestionKey: "cover",
    },
    {
      id: "gallery",
      done: provider.gallery.length >= 3,
      weight: 7,
      suggestionKey: "gallery",
    },
  ];

  const earned = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  const score = Math.min(100, Math.round(earned));
  const suggestions = items.filter((item) => !item.done);

  return { score, items, suggestions };
}
