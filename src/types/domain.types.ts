import type { ServiceCategory } from "@/lib/constants/categories";
import type { Locale } from "@/lib/i18n/config";

export type LocalizedText = Record<Locale, string>;

export type MockProvider = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: ServiceCategory;
  city: LocalizedText;
  district: LocalizedText;
  rating: number;
  reviewCount: number;
  trustScore: number;
  verified: boolean;
  distanceKm: number;
  coverImage: string;
  avatarImage: string;
  about: LocalizedText;
  services: LocalizedText[];
  gallery: string[];
  phone: string;
  whatsapp: string;
  featured: boolean;
  responseTimeHours: number;
};

export type MockReview = {
  id: string;
  providerId: string;
  author: LocalizedText;
  rating: number;
  comment: LocalizedText;
  date: string;
};

export type SortOption = "best_match" | "highest_rated" | "nearest" | "verified";

export type SearchFilters = {
  query?: string;
  category?: ServiceCategory;
  city?: string;
  verifiedOnly?: boolean;
  minRating?: number;
  sort?: SortOption;
};

export function getLocalizedText(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
