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

/**
 * Profile completeness for ranking & UI.
 *
 * Core business fields alone can reach a strong score — logo/gallery/cover
 * are optional richness, never a large penalty for missing photos.
 *
 * Core max ≈ 88 · Optional media/hours bonus ≈ +12 → 100
 */
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
  let core = 0;

  if (hasBothLocales(input.name)) core += 16;
  else if (hasText(input.name)) core += 10;

  if (hasBothLocales(input.about)) core += 16;
  else if (hasText(input.about)) core += 10;

  if (input.phone?.trim()) core += 12;
  if (input.whatsapp?.trim()) core += 8;
  if (input.email?.trim()) core += 6;
  if (input.website?.trim()) core += 5;
  if (input.categoryId && input.cityId) core += 15;
  if (input.servicesCount > 0) core += 10;

  // Optional richness — small positive bonus only (never a penalty for missing media)
  // Logo +2 · Cover +2 · ≥3 work photos +4 · hours extra
  let bonus = 0;
  if (input.avatarImageId) bonus += 2;
  if (input.coverImageId) bonus += 2;
  if (input.galleryCount >= 3) bonus += 4;

  const configuredHours = input.workingHours.filter(
    (h) => h.isClosed || (h.opensAt && h.closesAt),
  );
  if (configuredHours.length >= 5) bonus += 4;

  return Math.min(100, core + bonus);
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
