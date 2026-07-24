"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
import { generateProviderSlug } from "@/lib/auth/utils";
import { createClient } from "@/lib/supabase/server";
import { resolveCategorySlugToId } from "@/lib/categories/queries";
import { CITY_IDS, MODULE_SERVICES_ID } from "@/lib/constants/reference-data";
import {
  calculateProfileCompleteness,
  completenessFromProvider,
} from "@/lib/providers/completion";
import { getOwnedProvider, requireOwnedProvider } from "@/lib/providers/database";
import { ensureFreeSubscription } from "@/lib/subscription/repository";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_BYTES,
  PROVIDER_MEDIA_BUCKET,
} from "@/lib/providers/constants";
import { getProviderPlanLimits } from "@/lib/subscription/get-provider-limits";
import { buildProviderMediaPath, isOwnedProviderMediaPath } from "@/lib/providers/storage";
import {
  createProviderSchema,
  onboardingProfileSchema,
  serviceInputSchema,
  updateContactSchema,
  updateProviderProfileSchema,
  updateServiceSchema,
  workingHoursSchema,
} from "@/lib/validations/provider";
import { resolveLocalizedField } from "@/lib/business/resolve-localized-fields";
import type { Locale } from "@/lib/i18n/config";
import type { ImageKind } from "@/types/database.types";
import { buildLocalizedField } from "@/types/provider.types";

export type ProviderActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  /** Direct-upload prepare payload (never includes file bytes). */
  upload?: {
    path: string;
    token: string;
    signedUrl: string;
  };
};

const imagePrepareMetaSchema = z.object({
  providerId: z.string().uuid(),
  kind: z.enum(["avatar", "cover", "gallery"]),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(100),
  size: z.number().int().positive(),
});

const imageConfirmMetaSchema = z.object({
  providerId: z.string().uuid(),
  kind: z.enum(["avatar", "cover", "gallery"]),
  path: z.string().trim().min(8).max(500),
  mimeType: z.string().trim().min(3).max(100),
  size: z.number().int().positive(),
});

async function revalidateBusiness(providerId?: string) {
  revalidatePath("/business", "layout");
  if (providerId) {
    revalidatePath(`/providers/${providerId}`);
    revalidatePath("/", "layout");
  }
}

async function requireBusinessOwner() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { authUser: null, error: "forbidden" as const };
  }
  if (!isBusinessUser(authUser.roles)) {
    return { authUser: null, error: "forbidden" as const };
  }
  return { authUser, error: null };
}

async function syncProfileCompleteness(userId: string) {
  const provider = await requireOwnedProvider(userId);
  const completeness = completenessFromProvider(provider);
  const supabase = await createClient();
  await supabase
    .from("providers")
    .update({ profile_completeness: completeness, updated_by: userId })
    .eq("id", provider.id)
    .eq("owner_id", userId);
}

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    success: false,
    error: "validation_error" as const,
    fieldErrors: error.flatten().fieldErrors,
  };
}

/** Translation is best-effort; never fails the enclosing business action. */
async function translateOptional(
  locale: Locale,
  sourceText: string,
  existing = { ar: "", en: "" },
) {
  return resolveLocalizedField(locale, sourceText, existing);
}

export async function createProviderAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const existing = await getOwnedProvider(authUser.id);
  if (existing) return { success: false, error: "provider_exists" };

  const parsed = createProviderSchema.safeParse({
    locale: formData.get("locale"),
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    about: formData.get("about"),
  });

  if (!parsed.success) return validationError(parsed.error);

  const categoryId = await resolveCategorySlugToId(parsed.data.category);
  const cityId = CITY_IDS[parsed.data.city];
  if (!categoryId || !cityId) return { success: false, error: "validation_error" };

  const name = await translateOptional(parsed.data.locale, parsed.data.businessName);
  const about = await translateOptional(parsed.data.locale, parsed.data.about);

  const supabase = await createClient();
  const slug = generateProviderSlug(name.en || name.ar || parsed.data.businessName, authUser.id);

  const completeness = calculateProfileCompleteness({
    name,
    about,
    phone: parsed.data.phone,
    whatsapp: parsed.data.phone,
    email: parsed.data.email,
    website: null,
    categoryId,
    cityId,
    avatarImageId: null,
    coverImageId: null,
    servicesCount: 0,
    galleryCount: 0,
    workingHours: [],
  });

  const { data: created, error } = await supabase
    .from("providers")
    .insert({
      owner_id: authUser.id,
      slug,
      name,
      about,
      module_id: MODULE_SERVICES_ID,
      category_id: categoryId,
      city_id: cityId,
      phone: parsed.data.phone,
      whatsapp: parsed.data.phone,
      email: parsed.data.email,
      status: "draft",
      verification_status: "unverified",
      profile_completeness: completeness,
      created_by: authUser.id,
      updated_by: authUser.id,
    })
    .select("id")
    .single();

  if (error || !created) return { success: false, error: "create_failed" };

  await ensureFreeSubscription(created.id);

  await revalidateBusiness();
  return { success: true, message: "created" };
}

export async function updateProviderProfileAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = updateProviderProfileSchema.safeParse({
    locale: formData.get("locale"),
    businessName: formData.get("businessName"),
    about: formData.get("about"),
    category: formData.get("category"),
    city: formData.get("city"),
  });

  if (!parsed.success) return validationError(parsed.error);

  const categoryId = await resolveCategorySlugToId(parsed.data.category);
  const cityId = CITY_IDS[parsed.data.city];
  if (!categoryId || !cityId) return { success: false, error: "validation_error" };

  const name = await translateOptional(parsed.data.locale, parsed.data.businessName, provider.name);
  const about = await translateOptional(
    parsed.data.locale,
    parsed.data.about,
    provider.about ?? { ar: "", en: "" },
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({
      name,
      about,
      category_id: categoryId,
      city_id: cityId,
      updated_by: authUser.id,
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "update_failed" };

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "saved" };
}

export async function updateContactAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = updateContactSchema.safeParse({
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    website: formData.get("website"),
    addressAr: formData.get("addressAr"),
    addressEn: formData.get("addressEn"),
  });

  if (!parsed.success) return validationError(parsed.error);

  const addressLine =
    parsed.data.addressAr || parsed.data.addressEn
      ? buildLocalizedField(parsed.data.addressAr ?? "", parsed.data.addressEn ?? "")
      : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({
      phone: parsed.data.phone,
      whatsapp: parsed.data.whatsapp || parsed.data.phone,
      email: parsed.data.email,
      website: parsed.data.website || null,
      address_line: addressLine,
      updated_by: authUser.id,
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "update_failed" };

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "saved" };
}

/** Autosave for guided onboarding — profile essentials without media. */
export async function saveOnboardingProfileAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = onboardingProfileSchema.safeParse({
    locale: formData.get("locale"),
    businessName: formData.get("businessName"),
    about: formData.get("about"),
    category: formData.get("category"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });

  if (!parsed.success) return validationError(parsed.error);

  const categoryId = await resolveCategorySlugToId(parsed.data.category);
  const cityId = CITY_IDS[parsed.data.city];
  if (!categoryId || !cityId) return { success: false, error: "validation_error" };

  const name = await translateOptional(parsed.data.locale, parsed.data.businessName, provider.name);
  const about = await translateOptional(
    parsed.data.locale,
    parsed.data.about,
    provider.about ?? { ar: "", en: "" },
  );
  const addressLine = buildLocalizedField(
    parsed.data.locale === "ar" ? parsed.data.address : (provider.addressLine?.ar ?? parsed.data.address),
    parsed.data.locale === "en" ? parsed.data.address : (provider.addressLine?.en ?? parsed.data.address),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({
      name,
      about,
      category_id: categoryId,
      city_id: cityId,
      phone: parsed.data.phone,
      whatsapp: provider.whatsapp || parsed.data.phone,
      address_line: addressLine,
      updated_by: authUser.id,
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "update_failed" };

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "saved" };
}

export async function updateWorkingHoursAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  let hoursJson: unknown;
  try {
    hoursJson = JSON.parse(String(formData.get("hours") ?? "[]"));
  } catch {
    return { success: false, error: "validation_error" };
  }

  const parsed = workingHoursSchema.safeParse({ hours: hoursJson });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();

  for (const hour of parsed.data.hours) {
    if (!hour.isClosed && (!hour.opensAt || !hour.closesAt)) {
      return { success: false, error: "invalid_hours" };
    }

    const { error } = await supabase.from("provider_working_hours").upsert(
      {
        provider_id: provider.id,
        day_of_week: hour.dayOfWeek,
        opens_at: hour.isClosed ? null : `${hour.opensAt}:00`,
        closes_at: hour.isClosed ? null : `${hour.closesAt}:00`,
        is_closed: hour.isClosed,
      },
      { onConflict: "provider_id,day_of_week" },
    );

    if (error) return { success: false, error: "update_failed" };
  }

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "saved" };
}

export async function addServiceAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = serviceInputSchema.safeParse({
    locale: formData.get("locale"),
    name: formData.get("name"),
    // FormData.get() returns `null` (not `undefined`) for a field that isn't
    // present in the form — this form has no description input at all, so
    // that was always `null` here, which fails zod's `.optional()` (it only
    // accepts `undefined`) and made every submission fail validation
    // regardless of `name`.
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return validationError(parsed.error);

  const limits = await getProviderPlanLimits(provider.id);
  if (limits.maxServices !== null && provider.services.length >= limits.maxServices) {
    return { success: false, error: "service_limit" };
  }

  const name = await translateOptional(parsed.data.locale, parsed.data.name);

  const description =
    parsed.data.description && parsed.data.description.trim()
      ? await translateOptional(parsed.data.locale, parsed.data.description)
      : null;

  const supabase = await createClient();
  const sortOrder = provider.services.length;

  const { error } = await supabase.from("provider_services").insert({
    provider_id: provider.id,
    name,
    description,
    sort_order: sortOrder,
  });

  if (error) return { success: false, error: "create_failed" };

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "service_added" };
}

export async function updateServiceAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = updateServiceSchema.safeParse({
    serviceId: formData.get("serviceId"),
    locale: formData.get("locale"),
    name: formData.get("name"),
    // Same FormData null-vs-undefined issue as addServiceAction above — this
    // form has no description input either.
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return validationError(parsed.error);

  const existingService = provider.services.find((service) => service.id === parsed.data.serviceId);
  if (!existingService) return { success: false, error: "not_found" };

  const name = await translateOptional(parsed.data.locale, parsed.data.name, existingService.name);

  const description =
    parsed.data.description && parsed.data.description.trim()
      ? await translateOptional(
          parsed.data.locale,
          parsed.data.description,
          existingService.description ?? { ar: "", en: "" },
        )
      : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("provider_services")
    .update({
      name,
      description,
    })
    .eq("id", parsed.data.serviceId)
    .eq("provider_id", provider.id);

  if (error) return { success: false, error: "update_failed" };

  await revalidateBusiness();
  return { success: true, message: "service_updated" };
}

export async function deleteServiceAction(serviceId: string): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("provider_services")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", serviceId)
    .eq("provider_id", provider.id);

  if (error) return { success: false, error: "delete_failed" };

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "service_deleted" };
}

/**
 * Step 1: validate metadata + ownership + plan limits, return a signed
 * upload target. File bytes never enter this action.
 */
export async function prepareProviderImageUploadAction(meta: {
  providerId: string;
  kind: string;
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = imagePrepareMetaSchema.safeParse(meta);
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.providerId !== provider.id) return { success: false, error: "forbidden" };

  if (parsed.data.size > MAX_IMAGE_BYTES) return { success: false, error: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(parsed.data.mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { success: false, error: "invalid_file_type" };
  }

  const limits = await getProviderPlanLimits(provider.id);
  const galleryCap = Math.min(limits.maxImages ?? MAX_GALLERY_IMAGES, MAX_GALLERY_IMAGES);
  if (parsed.data.kind === "gallery" && provider.gallery.length >= galleryCap) {
    return { success: false, error: "gallery_limit" };
  }

  const path = buildProviderMediaPath(authUser.id, provider.id, parsed.data.kind, parsed.data.fileName);

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PROVIDER_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl || !data.token) {
    return { success: false, error: "upload_failed" };
  }

  return {
    success: true,
    upload: { path: data.path || path, token: data.token, signedUrl: data.signedUrl },
  };
}

/**
 * Step 2: after the direct Storage upload, persist path/mime/size and
 * apply the same side effects the old FormData action used to perform.
 */
export async function confirmProviderImageUploadAction(meta: {
  providerId: string;
  kind: string;
  path: string;
  mimeType: string;
  size: number;
}): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = imageConfirmMetaSchema.safeParse(meta);
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.providerId !== provider.id) return { success: false, error: "forbidden" };

  if (parsed.data.size > MAX_IMAGE_BYTES) return { success: false, error: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(parsed.data.mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { success: false, error: "invalid_file_type" };
  }

  const kind = parsed.data.kind as ImageKind;
  const path = parsed.data.path;

  if (!isOwnedProviderMediaPath(path, authUser.id, provider.id, kind)) {
    return { success: false, error: "forbidden" };
  }

  const supabase = await createClient();

  const limits = await getProviderPlanLimits(provider.id);
  const galleryCap = Math.min(limits.maxImages ?? MAX_GALLERY_IMAGES, MAX_GALLERY_IMAGES);
  if (kind === "gallery" && provider.gallery.length >= galleryCap) {
    await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([path]);
    return { success: false, error: "gallery_limit" };
  }

  const folder = path.slice(0, path.lastIndexOf("/"));
  const objectName = path.slice(path.lastIndexOf("/") + 1);
  const { data: listing } = await supabase.storage
    .from(PROVIDER_MEDIA_BUCKET)
    .list(folder, { search: objectName });
  if (!listing?.some((entry) => entry.name === objectName)) {
    return { success: false, error: "upload_failed" };
  }

  if (kind === "avatar" || kind === "cover") {
    const existingId = kind === "avatar" ? provider.avatarImageId : provider.coverImageId;

    const { data: imageRow, error: imageError } = await supabase
      .from("images")
      .insert({
        owner_id: authUser.id,
        provider_id: provider.id,
        path,
        kind,
        mime_type: parsed.data.mimeType,
        size_bytes: parsed.data.size,
        sort_order: 0,
      })
      .select("id")
      .single();

    if (imageError || !imageRow) {
      await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([path]);
      return { success: false, error: "upload_failed" };
    }

    const providerPatch =
      kind === "avatar"
        ? { avatar_image_id: imageRow.id }
        : { cover_image_id: imageRow.id };

    const { error: providerError } = await supabase
      .from("providers")
      .update({ ...providerPatch, updated_by: authUser.id })
      .eq("id", provider.id);

    if (providerError) {
      // Roll back the new image row + storage object; keep the previous avatar/cover.
      await supabase
        .from("images")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", imageRow.id);
      await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([path]);
      return { success: false, error: "upload_failed" };
    }

    // Only after the provider points at the new image, retire the old one.
    if (existingId) {
      const { data: oldImage } = await supabase
        .from("images")
        .select("path")
        .eq("id", existingId)
        .maybeSingle();
      await supabase
        .from("images")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", existingId);
      if (oldImage?.path && oldImage.path !== path) {
        await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([oldImage.path]);
      }
    }

    await syncProfileCompleteness(authUser.id);
    await revalidateBusiness(provider.id);
    return {
      success: true,
      message: kind === "avatar" ? "logo_updated" : "cover_updated",
    };
  }

  const { data: imageRow, error: imageError } = await supabase
    .from("images")
    .insert({
      owner_id: authUser.id,
      provider_id: provider.id,
      path,
      kind,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.size,
      sort_order: kind === "gallery" ? provider.gallery.length : 0,
    })
    .select("id")
    .single();

  if (imageError || !imageRow) {
    await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([path]);
    return { success: false, error: "upload_failed" };
  }

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness(provider.id);
  return {
    success: true,
    message: "uploaded",
  };
}

export async function deleteProviderMediaAction(
  kind: "avatar" | "cover",
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);
  const imageId = kind === "avatar" ? provider.avatarImageId : provider.coverImageId;
  if (!imageId) return { success: false, error: "not_found" };

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("images")
    .select("path, kind")
    .eq("id", imageId)
    .eq("provider_id", provider.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!image || image.kind !== kind) return { success: false, error: "not_found" };

  await supabase
    .from("images")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", imageId)
    .eq("provider_id", provider.id);

  await supabase
    .from("providers")
    .update({
      ...(kind === "avatar" ? { avatar_image_id: null } : { cover_image_id: null }),
      updated_by: authUser.id,
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (image.path) {
    await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([image.path]);
  }

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness(provider.id);
  return {
    success: true,
    message: kind === "avatar" ? "logo_deleted" : "cover_deleted",
  };
}

export async function deleteGalleryImageAction(imageId: string): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("images")
    .select("path, kind")
    .eq("id", imageId)
    .eq("provider_id", provider.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!image || image.kind !== "gallery") return { success: false, error: "not_found" };

  const { error } = await supabase
    .from("images")
    .update({ deleted_at: new Date().toISOString(), is_featured: false })
    .eq("id", imageId)
    .eq("provider_id", provider.id);

  if (error) return { success: false, error: "delete_failed" };

  await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([image.path]);
  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness(provider.id);
  return { success: true, message: "deleted" };
}

export async function reorderGalleryImagesAction(
  orderedIds: string[],
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: false, error: "validation_error" };
  }

  const galleryIds = new Set(provider.gallery.map((image) => image.id));
  if (orderedIds.length !== galleryIds.size || orderedIds.some((id) => !galleryIds.has(id))) {
    return { success: false, error: "validation_error" };
  }

  const supabase = await createClient();
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("images")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("provider_id", provider.id)
      .eq("kind", "gallery")
      .is("deleted_at", null),
  );

  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) {
    return { success: false, error: "update_failed" };
  }

  await revalidateBusiness(provider.id);
  return { success: true, message: "gallery_reordered" };
}

export async function setFeaturedGalleryImageAction(
  imageId: string,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const target = provider.gallery.find((image) => image.id === imageId);
  if (!target) return { success: false, error: "not_found" };

  const supabase = await createClient();
  await supabase
    .from("images")
    .update({ is_featured: false })
    .eq("provider_id", provider.id)
    .eq("kind", "gallery")
    .is("deleted_at", null);

  const { error } = await supabase
    .from("images")
    .update({ is_featured: true, sort_order: 0 })
    .eq("id", imageId)
    .eq("provider_id", provider.id)
    .eq("kind", "gallery")
    .is("deleted_at", null);

  if (error) return { success: false, error: "update_failed" };

  // Keep remaining images ordered after the featured one.
  const others = provider.gallery.filter((image) => image.id !== imageId);
  await Promise.all(
    others.map((image, index) =>
      supabase
        .from("images")
        .update({ sort_order: index + 1 })
        .eq("id", image.id)
        .eq("provider_id", provider.id),
    ),
  );

  await revalidateBusiness(provider.id);
  return { success: true, message: "featured_updated" };
}

export async function deleteProviderAction(): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("providers")
    .update({
      deleted_at: new Date().toISOString(),
      status: "archived",
      updated_by: authUser.id,
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "delete_failed" };

  await revalidateBusiness();
  return { success: true, message: "deleted" };
}

export async function submitProviderForReviewAction(): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  if (provider.status !== "draft" && provider.status !== "changes_requested") {
    return { success: false, error: "invalid_status" };
  }

  const { getApprovalReadiness } = await import("@/lib/providers/approval-readiness");
  const readiness = await getApprovalReadiness(provider);

  if (!readiness.ready) {
    if (!readiness.hasIdDocument) return { success: false, error: "id_document_required" };
    return { success: false, error: "incomplete_profile" };
  }

  const supabase = await createClient();

  await supabase
    .from("provider_verifications")
    .update({
      status: "pending",
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("provider_id", provider.id);

  const { error } = await supabase
    .from("providers")
    .update({
      status: "pending_review",
      verification_status: "pending",
      admin_review_note: null,
      changes_requested_at: null,
      updated_by: authUser.id,
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "submit_failed" };

  await revalidateBusiness();
  return { success: true, message: "submitted" };
}
