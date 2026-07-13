import type {
  ImageKind,
  LocalizedJson,
  ProviderStatus,
  VerificationStatus,
} from "@/types/database.types";

export type ProviderImage = {
  id: string;
  path: string;
  url: string;
  kind: ImageKind;
  sortOrder: number;
};

export type ProviderService = {
  id: string;
  name: LocalizedJson;
  description: LocalizedJson | null;
  sortOrder: number;
  isActive: boolean;
};

export type WorkingHour = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

export type ManagedProvider = {
  id: string;
  slug: string;
  name: LocalizedJson;
  about: LocalizedJson | null;
  categoryId: string;
  cityId: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  addressLine: LocalizedJson | null;
  status: ProviderStatus;
  verificationStatus: VerificationStatus;
  profileCompleteness: number;
  avatarImageId: string | null;
  coverImageId: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  services: ProviderService[];
  gallery: ProviderImage[];
  workingHours: WorkingHour[];
};

export const WEEKDAY_ORDER = [0, 1, 2, 3, 4, 5, 6] as const;

export function getLocalizedField(value: LocalizedJson | null, locale: string): string {
  if (!value) return "";
  return locale === "en" ? value.en || value.ar : value.ar || value.en;
}

export function buildLocalizedField(ar: string, en: string): LocalizedJson {
  return { ar: ar.trim(), en: en.trim() };
}
