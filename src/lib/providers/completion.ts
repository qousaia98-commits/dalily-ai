import type { ManagedProvider, WorkingHour } from "@/types/provider.types";
import type { LocalizedJson } from "@/types/database.types";

function hasText(value: LocalizedJson | null | undefined): boolean {
  if (!value) return false;
  return Boolean(value.ar.trim() || value.en.trim());
}

function hasBothLocales(value: LocalizedJson | null | undefined): boolean {
  if (!value) return false;
  return Boolean(value.ar.trim() && value.en.trim());
}

export function calculateProfileCompleteness(input: {
  name: LocalizedJson;
  about: LocalizedJson | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  categoryId: string;
  cityId: string;
  avatarImageId: string | null;
  coverImageId: string | null;
  servicesCount: number;
  galleryCount: number;
  workingHours: WorkingHour[];
}): number {
  let score = 0;

  if (hasBothLocales(input.name)) score += 10;
  else if (hasText(input.name)) score += 5;

  if (hasBothLocales(input.about)) score += 10;
  else if (hasText(input.about)) score += 5;

  if (input.phone?.trim()) score += 5;
  if (input.whatsapp?.trim()) score += 5;
  if (input.email?.trim()) score += 5;
  if (input.website?.trim()) score += 5;
  if (input.categoryId && input.cityId) score += 10;
  if (input.avatarImageId) score += 15;
  if (input.coverImageId) score += 10;
  if (input.servicesCount > 0) score += 15;
  if (input.galleryCount > 0) score += 10;

  const configuredHours = input.workingHours.filter(
    (h) => h.isClosed || (h.opensAt && h.closesAt),
  );
  if (configuredHours.length >= 5) score += 5;

  return Math.min(100, score);
}

export function completenessFromProvider(provider: ManagedProvider): number {
  return calculateProfileCompleteness({
    name: provider.name,
    about: provider.about,
    phone: provider.phone,
    whatsapp: provider.whatsapp,
    email: provider.email,
    website: provider.website,
    categoryId: provider.categoryId,
    cityId: provider.cityId,
    avatarImageId: provider.avatarImageId,
    coverImageId: provider.coverImageId,
    servicesCount: provider.services.length,
    galleryCount: provider.gallery.length,
    workingHours: provider.workingHours,
  });
}
