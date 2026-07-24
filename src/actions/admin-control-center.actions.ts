"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser, isPlatformAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/action-log";
import { resolveBroadcastRecipients, type BroadcastTarget } from "@/lib/admin/broadcasts";
import {
  deliverMarketplaceNotification,
  deliverMarketplaceNotificationsBatch,
  type BroadcastDeliveryDiagnostics,
} from "@/lib/notifications/deliver";

export type AdminModerationState = {
  success: boolean;
  error?: string;
  deliveryCount?: number;
  diagnostics?: BroadcastDeliveryDiagnostics;
};

function forbidden(): AdminModerationState {
  return { success: false, error: "forbidden" };
}

const idSchema = z.string().uuid();

export async function updateIssueModerationAction(input: {
  issueId: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  notes?: string;
  assignToSelf?: boolean;
}): Promise<AdminModerationState> {
  const authUser = await requireAdminUser();
  if (!isAdminUser(authUser.roles)) return forbidden();

  const parsed = idSchema.safeParse(input.issueId);
  if (!parsed.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    moderation_status: input.status,
    admin_notes: input.notes?.trim() || null,
  };
  if (input.assignToSelf) patch.assigned_to = authUser.id;
  if (input.status === "resolved" || input.status === "closed") {
    patch.resolved_at = now;
    patch.resolved_by = authUser.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("booking_issue_reports")
    .update(patch)
    .eq("id", parsed.data)
    .is("deleted_at", null);

  if (error) return { success: false, error: "update_failed" };

  await logAdminAction({
    actorId: authUser.id,
    action: "issue_moderation_updated",
    entityType: "booking_issue_report",
    entityId: parsed.data,
    metadata: { status: input.status },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/issues");
  return { success: true };
}

export async function moderateReviewAction(input: {
  reviewId: string;
  action: "hide" | "restore" | "delete";
}): Promise<AdminModerationState> {
  const authUser = await requireAdminUser();
  if (!isAdminUser(authUser.roles)) return forbidden();

  const parsed = idSchema.safeParse(input.reviewId);
  if (!parsed.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: reviewRow, error: fetchError } = await admin
    .from("service_reviews")
    .select("id, provider_id")
    .eq("id", parsed.data)
    .maybeSingle();

  if (fetchError || !reviewRow?.provider_id) {
    return { success: false, error: "not_found" };
  }

  if (input.action === "delete") {
    const { error } = await admin
      .from("service_reviews")
      .update({ deleted_at: now, status: "hidden" })
      .eq("id", parsed.data);
    if (error) return { success: false, error: "update_failed" };
  } else {
    const status = input.action === "hide" ? "hidden" : "approved";
    const { error } = await admin
      .from("service_reviews")
      .update({ status, deleted_at: null })
      .eq("id", parsed.data);
    if (error) return { success: false, error: "update_failed" };
  }

  // Recompute provider.rating_avg / review_count / trust via existing RPC.
  await admin.rpc("recompute_provider_trust_score", {
    p_provider_id: reviewRow.provider_id,
  });

  await logAdminAction({
    actorId: authUser.id,
    action: `review_${input.action}`,
    entityType: "service_review",
    entityId: parsed.data,
    metadata: { providerId: reviewRow.provider_id },
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  revalidatePath(`/providers/${reviewRow.provider_id}`);
  return { success: true };
}

export async function warnUserAction(input: {
  userId: string;
  role: "provider" | "customer";
  message: string;
}): Promise<AdminModerationState> {
  const authUser = await requireAdminUser();
  if (!isAdminUser(authUser.roles)) return forbidden();

  const parsed = idSchema.safeParse(input.userId);
  if (!parsed.success) return { success: false, error: "validation_error" };
  if (!input.message.trim()) return { success: false, error: "validation_error" };

  await deliverMarketplaceNotification({
    userId: parsed.data,
    type: "admin_warning",
    titleKey: "notifications.adminWarning.title",
    bodyKey: "notifications.adminWarning.body",
    bodyParams: { message: input.message.trim(), role: input.role },
    href: input.role === "provider" ? "/business" : "/account",
  });

  await logAdminAction({
    actorId: authUser.id,
    action: "user_warned",
    entityType: "user",
    entityId: parsed.data,
    metadata: { role: input.role },
  });

  return { success: true };
}

export async function sendAdminBroadcastAction(input: {
  title: string;
  body: string;
  target: BroadcastTarget;
  targetUserId?: string;
  href?: string;
}): Promise<AdminModerationState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2 || body.length < 2) return { success: false, error: "validation_error" };

  const recipients = await resolveBroadcastRecipients(input.target, input.targetUserId);
  if (recipients.length === 0) {
    return { success: false, error: "no_recipients" };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Create broadcast row first so deliveries can reference it (audit + read tracking).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: broadcastRow, error: createError } = await (admin as any)
    .from("admin_broadcasts")
    .insert({
      created_by: authUser.id,
      title,
      body,
      target: input.target,
      target_user_id: input.target === "single" ? input.targetUserId ?? null : null,
      href: null,
      status: "sent",
      sent_at: now,
      delivery_count: 0,
      metadata: { recipientCount: recipients.length, readCount: 0 },
    })
    .select("id")
    .maybeSingle();

  if (createError || !broadcastRow?.id) {
    return { success: false, error: "update_failed" };
  }

  const broadcastId = broadcastRow.id as string;

  await logAdminAction({
    actorId: authUser.id,
    action: "broadcast_created",
    entityType: "admin_broadcast",
    entityId: broadcastId,
    metadata: {
      target: input.target,
      recipients: recipients.length,
      title,
    },
  });

  const { resolveDalilyInboxHrefs } = await import("@/lib/dalily-messages/inbox");
  const hrefByUserId = await resolveDalilyInboxHrefs(recipients);

  const diagnostics = await deliverMarketplaceNotificationsBatch(
    recipients,
    {
      type: "dalily_message",
      titleKey: "notifications.dalilyMessage.title",
      bodyKey: "notifications.dalilyMessage.body",
      bodyParams: {
        title,
        body,
        broadcastId,
        category: "announcement",
      },
    },
    { max: 2000, hrefByUserId },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("admin_broadcasts")
    .update({
      status: diagnostics.deliverySuccess > 0 ? "sent" : "failed",
      delivery_count: diagnostics.deliverySuccess,
      metadata: {
        recipientCount: recipients.length,
        readCount: 0,
        diagnostics,
      },
    })
    .eq("id", broadcastId);

  await logAdminAction({
    actorId: authUser.id,
    action: "broadcast_delivered",
    entityType: "admin_broadcast",
    entityId: broadcastId,
    metadata: {
      target: input.target,
      recipients: recipients.length,
      deliveryCount: diagnostics.deliverySuccess,
      deliveryStatus: diagnostics.deliverySuccess > 0 ? "delivered" : "failed",
      diagnostics,
    },
  });

  revalidatePath("/admin/broadcasts");
  revalidatePath("/business/messages");
  revalidatePath("/messages");

  if (diagnostics.deliverySuccess === 0) {
    return {
      success: false,
      error: "delivery_failed",
      deliveryCount: 0,
      diagnostics,
    };
  }

  return {
    success: true,
    deliveryCount: diagnostics.deliverySuccess,
    diagnostics,
  };
}
