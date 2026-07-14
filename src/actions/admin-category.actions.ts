"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { MODULE_SERVICES_ID } from "@/lib/constants/reference-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAudit } from "@/lib/admin/audit";
import type { AdminActionState } from "@/actions/admin.actions";

const categoryIdSchema = z.string().uuid();

const createCategorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionAr: z.string().trim().max(500).optional(),
  descriptionEn: z.string().trim().max(500).optional(),
  icon: z.string().trim().min(1).max(50),
  sortOrder: z.coerce.number().int().min(0).max(999),
  parentId: z.preprocess(
    (val) => (!val || val === "" ? null : val),
    z.string().uuid().nullable(),
  ),
  depth: z.coerce.number().int().min(0).max(1),
});

const updateCategorySchema = createCategorySchema.extend({
  id: categoryIdSchema,
  isActive: z.coerce.boolean(),
});

function forbidden(): AdminActionState {
  return { success: false, error: "forbidden" };
}

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/providers");
  revalidatePath("/search");
  revalidatePath("/");
}

export async function createCategoryAction(formData: FormData): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parentRaw = formData.get("parentId");
  const parentId =
    parentRaw && String(parentRaw).trim().length > 0 ? String(parentRaw) : null;

  const parsed = createCategorySchema.safeParse({
    slug: formData.get("slug"),
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
    descriptionAr: formData.get("descriptionAr") || undefined,
    descriptionEn: formData.get("descriptionEn") || undefined,
    icon: formData.get("icon"),
    sortOrder: formData.get("sortOrder"),
    parentId,
    depth: formData.get("depth"),
  });

  if (!parsed.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("categories")
    .insert({
      module_id: MODULE_SERVICES_ID,
      parent_id: parsed.data.parentId,
      slug: parsed.data.slug,
      name: { ar: parsed.data.nameAr, en: parsed.data.nameEn },
      description:
        parsed.data.descriptionAr || parsed.data.descriptionEn
          ? {
              ar: parsed.data.descriptionAr ?? "",
              en: parsed.data.descriptionEn ?? "",
            }
          : null,
      icon: parsed.data.icon,
      depth: parsed.data.depth,
      sort_order: parsed.data.sortOrder,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: "create_failed" };

  await logAdminAudit({
    actorId: authUser.id,
    action: "category_created",
    entityType: "category",
    entityId: data.id,
    metadata: { slug: parsed.data.slug },
  });

  revalidateCategories();
  return { success: true };
}

export async function updateCategoryAction(formData: FormData): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parentRaw = formData.get("parentId");
  const parentId =
    parentRaw && String(parentRaw).trim().length > 0 ? String(parentRaw) : null;

  const parsed = updateCategorySchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
    descriptionAr: formData.get("descriptionAr") || undefined,
    descriptionEn: formData.get("descriptionEn") || undefined,
    icon: formData.get("icon"),
    sortOrder: formData.get("sortOrder"),
    parentId,
    depth: formData.get("depth"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("categories")
    .update({
      parent_id: parsed.data.parentId,
      slug: parsed.data.slug,
      name: { ar: parsed.data.nameAr, en: parsed.data.nameEn },
      description:
        parsed.data.descriptionAr || parsed.data.descriptionEn
          ? {
              ar: parsed.data.descriptionAr ?? "",
              en: parsed.data.descriptionEn ?? "",
            }
          : null,
      icon: parsed.data.icon,
      depth: parsed.data.depth,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id);

  if (error) return { success: false, error: "update_failed" };

  await logAdminAudit({
    actorId: authUser.id,
    action: parsed.data.isActive ? "category_updated" : "category_disabled",
    entityType: "category",
    entityId: parsed.data.id,
    metadata: { slug: parsed.data.slug },
  });

  revalidateCategories();
  return { success: true };
}

export async function toggleCategoryActiveAction(
  categoryId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parsedId = categoryIdSchema.safeParse(categoryId);
  if (!parsedId.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", parsedId.data);

  if (error) return { success: false, error: "update_failed" };

  await logAdminAudit({
    actorId: authUser.id,
    action: isActive ? "category_enabled" : "category_disabled",
    entityType: "category",
    entityId: parsedId.data,
  });

  revalidateCategories();
  return { success: true };
}
