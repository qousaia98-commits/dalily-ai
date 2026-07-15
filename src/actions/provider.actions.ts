"use server";

import { revalidatePath } from "next/cache";
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
import { getOwnedProvider, requireOwnedProvider } from "@/lib/providers/queries";
import { ensureFreeSubscription } from "@/lib/subscription/repository";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  PROVIDER_MEDIA_BUCKET,
} from "@/lib/providers/constants";
import { getProviderPlanLimits } from "@/lib/subscription/get-provider-limits";
import { buildProviderMediaPath } from "@/lib/providers/storage";
import {
  createProviderSchema,
  imageUploadSchema,
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
};

async function revalidateBusiness() {
  revalidatePath("/business", "layout");
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
    description: formData.get("description"),
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
    description: formData.get("description"),
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

export async function uploadProviderImageAction(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const businessAuth = await requireBusinessOwner();
  if (!businessAuth.authUser) return { success: false, error: businessAuth.error };
  const authUser = businessAuth.authUser;
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = imageUploadSchema.safeParse({
    providerId: formData.get("providerId"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.providerId !== provider.id) return { success: false, error: "forbidden" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "file_required" };
  }

  if (file.size > MAX_IMAGE_BYTES) return { success: false, error: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { success: false, error: "invalid_file_type" };
  }

  const limits = await getProviderPlanLimits(provider.id);
  if (parsed.data.kind === "gallery" && limits.maxImages != null && provider.gallery.length >= limits.maxImages) {
    return { success: false, error: "gallery_limit" };
  }

  const supabase = await createClient();
  const kind = parsed.data.kind as ImageKind;
  const path = buildProviderMediaPath(authUser.id, provider.id, kind, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PROVIDER_MEDIA_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return { success: false, error: "upload_failed" };

  if (kind === "avatar" || kind === "cover") {
    const existingId = kind === "avatar" ? provider.avatarImageId : provider.coverImageId;
    if (existingId) {
      await supabase
        .from("images")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", existingId);
    }
  }

  const { data: imageRow, error: imageError } = await supabase
    .from("images")
    .insert({
      owner_id: authUser.id,
      provider_id: provider.id,
      path,
      kind,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: kind === "gallery" ? provider.gallery.length : 0,
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
      : kind === "cover"
        ? { cover_image_id: imageRow.id }
        : {};

  if (kind !== "gallery") {
    await supabase
      .from("providers")
      .update({ ...providerPatch, updated_by: authUser.id })
      .eq("id", provider.id);
  }

  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "uploaded" };
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
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", imageId)
    .eq("provider_id", provider.id);

  if (error) return { success: false, error: "delete_failed" };

  await supabase.storage.from(PROVIDER_MEDIA_BUCKET).remove([image.path]);
  await syncProfileCompleteness(authUser.id);
  await revalidateBusiness();
  return { success: true, message: "deleted" };
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

  if (provider.profileCompleteness < 60) {
    return { success: false, error: "incomplete_profile" };
  }

  if (provider.status !== "draft") {
    return { success: false, error: "invalid_status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({ status: "pending_review", updated_by: authUser.id })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "submit_failed" };

  await revalidateBusiness();
  return { success: true, message: "submitted" };
}
