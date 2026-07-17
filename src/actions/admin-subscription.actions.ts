"use server";

import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { logAdminAudit } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateSubscriptionSurfaces } from "@/lib/subscription/revalidate";
import { subscriptionService } from "@/lib/subscription/subscription.service";
import type { PlanSlug } from "@/lib/subscription/types";

export type AdminSubscriptionActionState = {
  success: boolean;
  error?: string;
};

async function providerSlug(providerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("providers").select("slug").eq("id", providerId).maybeSingle();
  return data?.slug ?? null;
}

async function revalidateForProvider(providerId: string) {
  revalidateSubscriptionSurfaces({ providerSlug: await providerSlug(providerId) });
}

export async function approvePaymentAction(paymentId: string): Promise<AdminSubscriptionActionState> {
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
    revalidateSubscriptionSurfaces({ providerSlug: result.providerSlug });
    return { success: true };
  } catch {
    return { success: false, error: "approve_failed" };
  }
}

export async function rejectPaymentAction(
  paymentId: string,
  adminNote?: string,
): Promise<AdminSubscriptionActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  try {
    const result = await subscriptionService.rejectPayment(paymentId, authUser.id, adminNote);
    await logAdminAudit({
      actorId: authUser.id,
      action: "payment_rejected",
      entityType: "payment",
      entityId: paymentId,
      metadata: { note: adminNote ?? null },
    });
    revalidateSubscriptionSurfaces({ providerSlug: result.providerSlug });
    return { success: true };
  } catch {
    return { success: false, error: "reject_failed" };
  }
}

const extendSchema = z.object({
  providerId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(365),
});

export async function extendSubscriptionAction(
  providerId: string,
  days: number,
): Promise<AdminSubscriptionActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  const parsed = extendSchema.safeParse({ providerId, days });
  if (!parsed.success) return { success: false, error: "validation_error" };

  try {
    await subscriptionService.adminExtendSubscription(parsed.data.providerId, parsed.data.days);
    await logAdminAudit({
      actorId: authUser.id,
      action: "subscription_extended",
      entityType: "provider",
      entityId: parsed.data.providerId,
      metadata: { days: parsed.data.days },
    });
    await revalidateForProvider(parsed.data.providerId);
    return { success: true };
  } catch {
    return { success: false, error: "extend_failed" };
  }
}

export async function cancelSubscriptionAdminAction(
  providerId: string,
): Promise<AdminSubscriptionActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  try {
    await subscriptionService.cancel(providerId);
    await logAdminAudit({
      actorId: authUser.id,
      action: "subscription_cancelled",
      entityType: "provider",
      entityId: providerId,
    });
    await revalidateForProvider(providerId);
    return { success: true };
  } catch {
    return { success: false, error: "cancel_failed" };
  }
}

const planSchema = z.enum(["free", "pro", "premium"]);

export async function changePlanAdminAction(
  providerId: string,
  planSlug: PlanSlug,
): Promise<AdminSubscriptionActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  const parsed = planSchema.safeParse(planSlug);
  if (!parsed.success) return { success: false, error: "validation_error" };

  try {
    await subscriptionService.adminChangePlan(providerId, parsed.data);
    await logAdminAudit({
      actorId: authUser.id,
      action: "subscription_plan_changed",
      entityType: "provider",
      entityId: providerId,
      metadata: { planSlug: parsed.data },
    });
    await revalidateForProvider(providerId);
    return { success: true };
  } catch {
    return { success: false, error: "change_failed" };
  }
}
