"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAudit } from "@/lib/admin/audit";
import {
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
} from "@/lib/email/dalily-email";
import { getProviderOwnerEmailContext } from "@/lib/email/provider-email-context";
import { ensureFreeSubscription } from "@/lib/subscription/repository";
import type { AppRole, ProviderStatus, UserStatus } from "@/types/database.types";

export type AdminActionState = {
  success: boolean;
  error?: string;
};

function forbidden(): AdminActionState {
  return { success: false, error: "forbidden" };
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/users");
  revalidatePath("/admin/verification");
  revalidatePath("/search");
}

const providerIdSchema = z.string().uuid();
const providerStatusSchema = z.enum(["active", "suspended", "archived", "pending_review", "draft"]);

export async function updateProviderStatusAction(
  providerId: string,
  status: ProviderStatus,
): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parsedId = providerIdSchema.safeParse(providerId);
  const parsedStatus = providerStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { success: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } =
    parsedStatus.data === "active"
      ? await admin
          .from("providers")
          .update({
            status: parsedStatus.data,
            updated_by: authUser.id,
            published_at: now,
          })
          .eq("id", parsedId.data)
      : await admin
          .from("providers")
          .update({
            status: parsedStatus.data,
            updated_by: authUser.id,
          })
          .eq("id", parsedId.data);

  if (error) return { success: false, error: "update_failed" };

  if (parsedStatus.data === "active") {
    await ensureFreeSubscription(parsedId.data);
    const owner = await getProviderOwnerEmailContext(parsedId.data);
    if (owner?.email) {
      await sendBusinessApprovedEmail({
        to: owner.email,
        businessName: owner.businessName,
        locale: owner.locale,
      });
    }
  }

  if (parsedStatus.data === "draft") {
    const owner = await getProviderOwnerEmailContext(parsedId.data);
    if (owner?.email) {
      await sendBusinessRejectedEmail({
        to: owner.email,
        businessName: owner.businessName,
        locale: owner.locale,
      });
    }
  }

  const auditAction =
    parsedStatus.data === "active"
      ? "provider_approved"
      : parsedStatus.data === "draft"
        ? "provider_rejected"
        : parsedStatus.data === "suspended"
          ? "provider_suspended"
          : parsedStatus.data === "archived"
            ? "provider_archived"
            : "provider_approved";

  await logAdminAudit({
    actorId: authUser.id,
    action: auditAction,
    entityType: "provider",
    entityId: parsedId.data,
    metadata: { status: parsedStatus.data },
  });

  revalidateAdmin();
  revalidatePath(`/admin/providers/${parsedId.data}`);
  revalidatePath("/business/subscription");
  revalidatePath("/business", "layout");
  return { success: true };
}

export async function deleteProviderAction(providerId: string): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parsedId = providerIdSchema.safeParse(providerId);
  if (!parsedId.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("providers")
    .update({ deleted_at: now, status: "archived", updated_by: authUser.id })
    .eq("id", parsedId.data);

  if (error) return { success: false, error: "delete_failed" };

  await logAdminAudit({
    actorId: authUser.id,
    action: "provider_deleted",
    entityType: "provider",
    entityId: parsedId.data,
  });

  revalidateAdmin();
  return { success: true };
}

const userStatusSchema = z.enum(["active", "suspended", "banned"]);
const roleSchema = z.enum(["user", "business", "admin", "moderator"]);

export async function updateUserStatusAction(
  userId: string,
  status: UserStatus,
): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  if (userId === authUser.id) return { success: false, error: "self_action" };

  const parsedId = providerIdSchema.safeParse(userId);
  const parsedStatus = userStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { success: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ status: parsedStatus.data }).eq("id", parsedId.data);

  if (error) return { success: false, error: "update_failed" };

  await logAdminAudit({
    actorId: authUser.id,
    action: parsedStatus.data === "active" ? "user_activated" : "user_disabled",
    entityType: "user",
    entityId: parsedId.data,
    metadata: { status: parsedStatus.data },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function changeUserRoleAction(
  userId: string,
  role: AppRole,
  grant: boolean,
): Promise<AdminActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  if (userId === authUser.id && !grant && role === "admin") {
    return { success: false, error: "self_action" };
  }

  const parsedId = providerIdSchema.safeParse(userId);
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedId.success || !parsedRole.success) {
    return { success: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (grant) {
    const { data: existing } = await admin
      .from("user_roles")
      .select("id, revoked_at")
      .eq("user_id", parsedId.data)
      .eq("role", parsedRole.data)
      .maybeSingle();

    if (existing?.revoked_at) {
      const { error } = await admin
        .from("user_roles")
        .update({ revoked_at: null, granted_by: authUser.id, granted_at: now })
        .eq("id", existing.id);
      if (error) return { success: false, error: "role_failed" };
    } else if (!existing) {
      const { error } = await admin.from("user_roles").insert({
        user_id: parsedId.data,
        role: parsedRole.data,
        granted_by: authUser.id,
      });
      if (error) return { success: false, error: "role_failed" };
    }
  } else {
    const { error } = await admin
      .from("user_roles")
      .update({ revoked_at: now })
      .eq("user_id", parsedId.data)
      .eq("role", parsedRole.data)
      .is("revoked_at", null);
    if (error) return { success: false, error: "role_failed" };
  }

  await logAdminAudit({
    actorId: authUser.id,
    action: "user_role_changed",
    entityType: "user",
    entityId: parsedId.data,
    metadata: { role: parsedRole.data, grant },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
