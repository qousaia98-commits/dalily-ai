"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin, canAccessAdminPanel } from "@/lib/auth/roles";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { upsertCellPolicy } from "@/domains/admin/cell-policies";
import { compUnlockSession } from "@/domains/admin/unlock-ops";
import { approvePaymentAction, rejectPaymentAction } from "@/actions/admin-payment.actions";

export type AdminOpsActionState = {
  success: boolean;
  error?: string;
};

async function requirePlatformAdminForOps() {
  if (!isAdminMigrationV2Enabled()) return { ok: false as const, error: "feature_disabled" };
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { ok: false as const, error: "forbidden" };
  return { ok: true as const, authUser };
}

export async function upsertCellPolicyAction(formData: FormData): Promise<AdminOpsActionState> {
  const gate = await requirePlatformAdminForOps();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = z
    .object({
      cityId: z.string().uuid(),
      categoryId: z.string().uuid(),
      frozen: z.boolean(),
      limitedAvailability: z.boolean(),
      concierge: z.boolean(),
      note: z.string().max(500).optional(),
      reason: z.string().trim().min(5).max(500),
    })
    .safeParse({
      cityId: formData.get("cityId"),
      categoryId: formData.get("categoryId"),
      frozen: formData.get("frozen") === "true" || formData.get("frozen") === "on",
      limitedAvailability:
        formData.get("limitedAvailability") === "true" ||
        formData.get("limitedAvailability") === "on",
      concierge: formData.get("concierge") === "true" || formData.get("concierge") === "on",
      note: String(formData.get("note") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });

  if (!parsed.success) return { success: false, error: "validation_error" };

  const result = await upsertCellPolicy({
    actorId: gate.authUser.id,
    ...parsed.data,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath("/admin/cells");
  revalidatePath("/admin/inspect");
  return { success: true };
}

export async function compUnlockSessionAction(formData: FormData): Promise<AdminOpsActionState> {
  const gate = await requirePlatformAdminForOps();
  if (!gate.ok) return { success: false, error: gate.error };

  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!z.string().uuid().safeParse(sessionId).success) {
    return { success: false, error: "validation_error" };
  }

  const result = await compUnlockSession({
    sessionId,
    actorId: gate.authUser.id,
    reason,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath("/admin/unlock-ops");
  revalidatePath(`/business/unlock/${sessionId}`);
  return { success: true };
}

/** Approve unlock fee payment from unlock-ops queue (platform admin). */
export async function approveUnlockQueuePaymentAction(
  paymentId: string,
): Promise<AdminOpsActionState> {
  const gate = await requirePlatformAdminForOps();
  if (!gate.ok) return { success: false, error: gate.error };
  return approvePaymentAction(paymentId);
}

export async function rejectUnlockQueuePaymentAction(
  paymentId: string,
  note?: string,
): Promise<AdminOpsActionState> {
  const gate = await requirePlatformAdminForOps();
  if (!gate.ok) return { success: false, error: gate.error };
  return rejectPaymentAction(paymentId, note);
}

/** Moderators may inspect; writes stay platform-admin. */
export async function assertCanInspectAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isAdminMigrationV2Enabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await requireAdminUser();
  if (!canAccessAdminPanel(authUser.roles)) return { ok: false, error: "forbidden" };
  return { ok: true };
}
