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

export function calculateBusinessHealth(provider: ManagedProvider): BusinessHealthResult {
  const configuredHours = provider.workingHours.filter(
    (h) => h.isClosed || (h.opensAt && h.closesAt),
  ).length;

  const items: HealthChecklistItem[] = [
    {
      id: "logo",
      done: Boolean(provider.avatarImageId),
      weight: 12,
      suggestionKey: "logo",
    },
    {
      id: "cover",
      done: Boolean(provider.coverImageId),
      weight: 10,
      suggestionKey: "cover",
    },
    {
      id: "gallery",
      done: provider.gallery.length >= 3,
      weight: 12,
      suggestionKey: "gallery",
    },
    {
      id: "description",
      done: Boolean(provider.about?.ar?.trim() || provider.about?.en?.trim()),
      weight: 12,
      suggestionKey: "description",
    },
    {
      id: "hours",
      done: configuredHours >= 5,
      weight: 10,
      suggestionKey: "hours",
    },
    {
      id: "verification",
      done:
        provider.verificationStatus === "verified" ||
        provider.verificationStatus === "partially_verified",
      weight: 14,
      suggestionKey: "verification",
    },
    {
      id: "phone",
      done: Boolean(provider.phone?.trim()),
      weight: 8,
      suggestionKey: "phone",
    },
    {
      id: "whatsapp",
      done: Boolean(provider.whatsapp?.trim()),
      weight: 8,
      suggestionKey: "whatsapp",
    },
    {
      id: "categories",
      done: Boolean(provider.categoryId) && provider.services.length > 0,
      weight: 8,
      suggestionKey: "categories",
    },
    {
      id: "location",
      done: Boolean(provider.cityId),
      weight: 6,
      suggestionKey: "location",
    },
  ];

  const earned = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  const score = Math.min(100, Math.round(earned));
  const suggestions = items.filter((item) => !item.done);

  return { score, items, suggestions };
}
