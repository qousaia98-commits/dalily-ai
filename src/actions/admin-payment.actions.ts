"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { logAdminAudit } from "@/lib/admin/audit";
import { subscriptionService } from "@/lib/subscription/subscription.service";

export type AdminPaymentActionState = {
  success: boolean;
  error?: string;
};

function revalidate() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin");
  revalidatePath("/business/subscription");
  revalidatePath("/business", "layout");
}

export async function approvePaymentAction(paymentId: string): Promise<AdminPaymentActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  try {
    const result = await subscriptionService.activateAfterPayment(paymentId, authUser.id);
    await logAdminAudit({
      actorId: authUser.id,
      action: "payment_approved",
      entityType: "payment",
      entityId: paymentId,
      metadata: { providerId: result.providerId, planSlug: result.planSlug ?? null },
    });
    revalidate();
    return { success: true };
  } catch {
    return { success: false, error: "approve_failed" };
  }
}

export async function rejectPaymentAction(
  paymentId: string,
  adminNote?: string,
): Promise<AdminPaymentActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  const note = z.string().max(1000).optional().safeParse(adminNote ?? "");
  if (!note.success) return { success: false, error: "validation_error" };

  try {
    const result = await subscriptionService.rejectPayment(
      paymentId,
      authUser.id,
      note.data || undefined,
    );
    await logAdminAudit({
      actorId: authUser.id,
      action: "payment_rejected",
      entityType: "payment",
      entityId: paymentId,
      metadata: { providerId: result.providerId, note: note.data || null },
    });
    revalidate();
    return { success: true };
  } catch {
    return { success: false, error: "reject_failed" };
  }
}
