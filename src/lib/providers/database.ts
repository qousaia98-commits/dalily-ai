import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getStoragePublicUrl, getStorageThumbnailUrl } from "@/lib/providers/storage";
import { getCategoryNameMap, getCategorySlugMap } from "@/lib/categories/queries";
import { categorySlugFromId, citySlugFromId } from "@/lib/providers/reference";
import { rankProviders } from "@/lib/search/ranking/rank-providers";
import { getActivePlanSlugsByProviderIds } from "@/lib/subscription/repository";
import { fetchActiveProviders, fetchImagePaths } from "@/lib/search/repository/provider-search.repository";
import { mapProviderRowsToListItems } from "@/lib/search/mapper/provider-list-mapper";
import type { CategorySlug } from "@/lib/categories/types";
import type { ProviderListItem } from "@/types/search.types";
import type { LocalizedText } from "@/types/domain.types";
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

function parseAddressLineJson(value: unknown): LocalizedJson | null {
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
    addressLine: parseAddressLineJson(provider.address_line),
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

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80";

const CITY_LABELS: Record<string, LocalizedText> = {
  damascus: { ar: "دمشق", en: "Damascus" },
  aleppo: { ar: "حلب", en: "Aleppo" },
  homs: { ar: "حمص", en: "Homs" },
  latakia: { ar: "اللاذقية", en: "Latakia" },
};

export type PublicProviderProfile = {
  id: string;
  slug: string;
  name: LocalizedJson;
  about: LocalizedJson | null;
  category: CategorySlug;
  categoryLabel: LocalizedText;
  city: LocalizedText;
  citySlug: string | null;
  district: LocalizedText | null;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  reviewCount: number;
  trustScore: number;
  verified: boolean;
  planSlug: import("@/lib/subscription/types").PlanSlug;
  profileCompleteness: number;
  memberSince: string;
  coverImage: string;
  avatarImage: string;
  phone: string | null;
  whatsapp: string | null;
  responseTimeHours: number | null;
  services: LocalizedJson[];
  gallery: string[];
};

function parseAddressLineText(value: unknown): LocalizedText | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as { ar?: string; en?: string };
  if (!obj.ar && !obj.en) return null;
  return { ar: obj.ar ?? "", en: obj.en ?? "" };
}

export async function getPublicProviderById(id: string): Promise<PublicProviderProfile | null> {
  const supabase = await createClient();

  const { data: provider, error } = await supabase
    .from("providers")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !provider) return null;

  if (
    provider.verification_status !== "verified" &&
    provider.verification_status !== "partially_verified"
  ) {
    return null;
  }

  const categorySlug = await categorySlugFromId(provider.category_id);
  if (!categorySlug) return null;

  const categoryNameBySlug = await getCategoryNameMap();
  const categoryName = categoryNameBySlug.get(categorySlug);
  if (!categoryName) return null;

  const cityKey = citySlugFromId(provider.city_id);
  const cityLabel =
    (cityKey && CITY_LABELS[cityKey]) ||
    ({ ar: cityKey ?? "", en: cityKey ?? "" } satisfies LocalizedText);

  const [imagesResult, servicesResult] = await Promise.all([
    supabase.from("images").select("*").eq("provider_id", provider.id).is("deleted_at", null),
    supabase
      .from("provider_services")
      .select("*")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order"),
  ]);

  const images = imagesResult.data ?? [];
  const avatar = images.find((image) => image.id === provider.avatar_image_id);
  const cover = images.find((image) => image.id === provider.cover_image_id);
  const gallery = images
    .filter((image) => image.kind === "gallery")
    .sort((a, b) => {
      if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
        return a.is_featured ? -1 : 1;
      }
      return a.sort_order - b.sort_order;
    })
    .map((image) => getStoragePublicUrl(image.path));

  const activeServices = (servicesResult.data ?? [])
    .filter((service) => service.is_active)
    .map((service) => service.name);

  const planMap = await getActivePlanSlugsByProviderIds([provider.id]);

  return {
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    about: provider.about,
    category: categorySlug,
    categoryLabel: { ar: categoryName.ar, en: categoryName.en },
    city: cityLabel,
    citySlug: cityKey ?? null,
    district: parseAddressLineText(provider.address_line),
    latitude: provider.latitude,
    longitude: provider.longitude,
    rating: Number(provider.rating_avg),
    reviewCount: provider.review_count,
    trustScore: provider.trust_score,
    verified: provider.verification_status === "verified",
    planSlug: planMap.get(provider.id) ?? "free",
    profileCompleteness: provider.profile_completeness,
    memberSince: provider.created_at,
    coverImage: cover ? getStoragePublicUrl(cover.path) : DEFAULT_COVER,
    avatarImage: avatar ? getStoragePublicUrl(avatar.path) : DEFAULT_AVATAR,
    phone: provider.phone,
    whatsapp: provider.whatsapp,
    responseTimeHours: provider.response_time_hours,
    services: activeServices,
    gallery,
  };
}

export async function getFeaturedProviders(limit = 3): Promise<ProviderListItem[]> {
  const rows = await fetchActiveProviders({ limit: 50 });
  const planSlugsByProviderId = await getActivePlanSlugsByProviderIds(rows.map((row) => row.id));
  const ranked = rankProviders(rows, { planSlugsByProviderId }).slice(0, limit);

  const imageIds = ranked
    .flatMap((row) => [row.avatar_image_id, row.cover_image_id])
    .filter((id): id is string => Boolean(id));

  const imagePathById = await fetchImagePaths(imageIds);
  const [categorySlugById, categoryNameBySlug] = await Promise.all([
    getCategorySlugMap(),
    getCategoryNameMap(),
  ]);
  return mapProviderRowsToListItems(
    ranked,
    imagePathById,
    categorySlugById,
    categoryNameBySlug,
    planSlugsByProviderId,
  );
}

export async function getOwnedProviderForVerification(
  userId: string,
): Promise<(ManagedProvider & { trustScore: number; ratingAvg: number }) | null> {
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

  const mapped = mapProviderRow(
    provider,
    imagesResult.data ?? [],
    servicesResult.data ?? [],
    hoursResult.data ?? [],
  );

  return {
    ...mapped,
    trustScore: provider.trust_score,
    ratingAvg: Number(provider.rating_avg),
  };
}
