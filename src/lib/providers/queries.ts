import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getStoragePublicUrl, getStorageThumbnailUrl } from "@/lib/providers/storage";
import type { ManagedProvider, ProviderImage, ProviderService, WorkingHour } from "@/types/provider.types";
import type { Database, LocalizedJson } from "@/types/database.types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];
type ImageRow = Database["public"]["Tables"]["images"]["Row"];
type ServiceRow = Database["public"]["Tables"]["provider_services"]["Row"];
type HoursRow = Database["public"]["Tables"]["provider_working_hours"]["Row"];

function mapImage(row: ImageRow): ProviderImage {
  return {
    id: row.id,
    path: row.path,
    url: getStoragePublicUrl(row.path),
    thumbnailUrl: getStorageThumbnailUrl(row.path),
    kind: row.kind,
    sortOrder: row.sort_order,
    isFeatured: Boolean(row.is_featured),
  };
}

function mapService(row: ServiceRow): ProviderService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapHours(rows: HoursRow[]): WorkingHour[] {
  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
  return Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    return {
      dayOfWeek: day,
      opensAt: row?.opens_at ?? null,
      closesAt: row?.closes_at ?? null,
      isClosed: row?.is_closed ?? false,
    };
  });
}

function parseAddressLine(value: unknown): LocalizedJson | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as { ar?: string; en?: string };
  if (!obj.ar && !obj.en) return null;
  return { ar: obj.ar ?? "", en: obj.en ?? "" };
}

export function mapProviderRow(
  provider: ProviderRow,
  images: ImageRow[],
  services: ServiceRow[],
  hours: HoursRow[],
): ManagedProvider {
  const activeImages = images.filter((i) => !i.deleted_at);
  const avatar = activeImages.find((i) => i.kind === "avatar" && i.id === provider.avatar_image_id);
  const cover = activeImages.find((i) => i.kind === "cover" && i.id === provider.cover_image_id);
  const gallery = activeImages
    .filter((i) => i.kind === "gallery")
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return a.sort_order - b.sort_order;
    })
    .map(mapImage);

  return {
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    about: provider.about,
    categoryId: provider.category_id,
    cityId: provider.city_id,
    phone: provider.phone,
    whatsapp: provider.whatsapp,
    email: provider.email,
    website: provider.website,
    addressLine: parseAddressLine(provider.address_line),
    status: provider.status,
    verificationStatus: provider.verification_status,
    profileCompleteness: provider.profile_completeness,
    reviewCount: provider.review_count,
    ratingAvg: Number(provider.rating_avg),
    responseTimeHours: provider.response_time_hours,
    createdAt: provider.created_at,
    adminReviewNote: provider.admin_review_note ?? null,
    changesRequestedAt: provider.changes_requested_at ?? null,
    avatarImageId: provider.avatar_image_id,
    coverImageId: provider.cover_image_id,
    avatarUrl: avatar ? getStoragePublicUrl(avatar.path) : null,
    coverUrl: cover ? getStoragePublicUrl(cover.path) : null,
    services: services.filter((s) => !s.deleted_at).sort((a, b) => a.sort_order - b.sort_order).map(mapService),
    gallery,
    workingHours: mapHours(hours),
  };
}

export const getOwnedProvider = cache(async function getOwnedProvider(
  userId: string,
): Promise<ManagedProvider | null> {
  const supabase = await createClient();

  const { data: provider, error } = await supabase
    .from("providers")
    .select("*")
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !provider) return null;

  const [imagesResult, servicesResult, hoursResult] = await Promise.all([
    supabase.from("images").select("*").eq("provider_id", provider.id).is("deleted_at", null),
    supabase
      .from("provider_services")
      .select("*")
      .eq("provider_id", provider.id)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase.from("provider_working_hours").select("*").eq("provider_id", provider.id),
  ]);

  return mapProviderRow(
    provider,
    imagesResult.data ?? [],
    servicesResult.data ?? [],
    hoursResult.data ?? [],
  );
});

export async function requireOwnedProvider(userId: string): Promise<ManagedProvider> {
  const provider = await getOwnedProvider(userId);
  if (!provider) throw new Error("PROVIDER_NOT_FOUND");
  return provider;
}
