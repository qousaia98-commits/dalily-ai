"use server";

import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { logAdminAudit } from "@/lib/admin/audit";
import { revalidateSubscriptionSurfaces } from "@/lib/subscription/revalidate";
import { subscriptionService } from "@/lib/subscription/subscription.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUnlockPaymentsV2Enabled } from "@/lib/config/feature-flags";
import {
  captureUnlockFeePayment,
  rejectUnlockFeePayment,
} from "@/domains/payment/capture";
import { revalidatePath } from "next/cache";
import { revalidateOrderSurfaces } from "@/lib/orders/revalidate";

export type AdminPaymentActionState = {
  success: boolean;
  error?: string;
};

export async function approvePaymentAction(paymentId: string): Promise<AdminPaymentActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  try {
    if (isUnlockPaymentsV2Enabled()) {
      const admin = createAdminClient();
      const { data: payment } = await admin
        .from("payments")
        .select("id, purpose, unlock_session_id, provider_id")
        .eq("id", paymentId)
        .maybeSingle();

      if (payment?.purpose === "unlock_fee") {
        const captured = await captureUnlockFeePayment({
          paymentId,
          actorId: authUser.id,
          source: "admin_approval",
          externalEventId: `admin_approval:${paymentId}`,
        });
        if (!captured.ok) return { success: false, error: captured.error };

        await logAdminAudit({
          actorId: authUser.id,
          action: "payment_approved",
          entityType: "payment",
          entityId: paymentId,
          metadata: {
            purpose: "unlock_fee",
            unlockSessionId: payment.unlock_session_id,
            grantId: captured.grantId,
            alreadyCaptured: captured.alreadyCaptured,
          },
        });

        let serviceRequestId: string | null = null;
        if (payment.unlock_session_id) {
          revalidatePath(`/business/unlock/${payment.unlock_session_id}`);
          const { data: session } = await admin
            .from("unlock_sessions")
            .select("service_request_id")
            .eq("id", payment.unlock_session_id)
            .maybeSingle();
          serviceRequestId = (session?.service_request_id as string) ?? null;
        }
        revalidatePath("/admin/payments");
        revalidateOrderSurfaces(serviceRequestId);
        return { success: true };
      }

      if (payment?.purpose === "business_subscription") {
        const { activateBusinessSubscriptionFromPayment } = await import(
          "@/lib/payment/business-subscription"
        );
        const activated = await activateBusinessSubscriptionFromPayment({
          paymentId,
          actorUserId: authUser.id,
          source: "admin_approval",
        });
        if (!activated.ok) return { success: false, error: activated.error };
        await logAdminAudit({
          actorId: authUser.id,
          action: "payment_approved",
          entityType: "payment",
          entityId: paymentId,
          metadata: {
            purpose: "business_subscription",
            renewed: activated.renewed,
          },
        });
        revalidatePath("/admin/payments");
        revalidatePath("/business/monetization");
        revalidatePath("/business/payments/history");
        return { success: true };
      }
    }

    const result = await subscriptionService.activateAfterPayment(paymentId, authUser.id);
    await logAdminAudit({
      actorId: authUser.id,
      action: "payment_approved",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        purpose: "subscription",
        providerId: result.providerId,
        planSlug: result.planSlug ?? null,
      },
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
): Promise<AdminPaymentActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return { success: false, error: "forbidden" };

  const note = z.string().max(1000).optional().safeParse(adminNote ?? "");
  if (!note.success) return { success: false, error: "validation_error" };

  try {
    if (isUnlockPaymentsV2Enabled()) {
      const admin = createAdminClient();
      const { data: payment } = await admin
        .from("payments")
        .select("id, purpose, unlock_session_id")
        .eq("id", paymentId)
        .maybeSingle();

      if (payment?.purpose === "unlock_fee") {
        const rejected = await rejectUnlockFeePayment({
          paymentId,
          actorId: authUser.id,
          adminNote: note.data || undefined,
        });
        if (!rejected.ok) return { success: false, error: rejected.error };

        await logAdminAudit({
          actorId: authUser.id,
          action: "payment_rejected",
          entityType: "payment",
          entityId: paymentId,
          metadata: {
            purpose: "unlock_fee",
            note: note.data || null,
            unlockSessionId: payment.unlock_session_id,
          },
        });
        let serviceRequestId: string | null = null;
        if (payment.unlock_session_id) {
          revalidatePath(`/business/unlock/${payment.unlock_session_id}`);
          const { data: session } = await admin
            .from("unlock_sessions")
            .select("service_request_id")
            .eq("id", payment.unlock_session_id)
            .maybeSingle();
          serviceRequestId = (session?.service_request_id as string) ?? null;
        }
        revalidatePath("/admin/payments");
        revalidateOrderSurfaces(serviceRequestId);
        return { success: true };
      }

      if (payment?.purpose === "business_subscription") {
        const { transitionPaymentStatus } = await import(
          "@/lib/payment/orchestration"
        );
        const rejected = await transitionPaymentStatus({
          paymentId,
          toStatus: "rejected",
          actorUserId: authUser.id,
          source: "admin",
          note: note.data || "admin_rejected",
        });
        if (!rejected.ok) return { success: false, error: rejected.error };
        await admin
          .from("payments")
          .update({
            rejected_at: new Date().toISOString(),
            rejected_by: authUser.id,
            admin_note: note.data || null,
          })
          .eq("id", paymentId);
        await logAdminAudit({
          actorId: authUser.id,
          action: "payment_rejected",
          entityType: "payment",
          entityId: paymentId,
          metadata: {
            purpose: "business_subscription",
            note: note.data || null,
          },
        });
        revalidatePath("/admin/payments");
        revalidatePath("/business/monetization");
        revalidatePath("/business/payments/history");
        return { success: true };
      }
    }

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
      metadata: { purpose: "subscription", providerId: result.providerId, note: note.data || null },
    });
    revalidateSubscriptionSurfaces({ providerSlug: result.providerSlug });
    return { success: true };
  } catch {
    return { success: false, error: "reject_failed" };
  }
}
