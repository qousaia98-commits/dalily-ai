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

  await logAdminAction({
    actorId: authUser.id,
    action: `review_${input.action}`,
    entityType: "service_review",
    entityId: parsed.data,
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
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

  const href =
    input.href ??
    (input.target === "providers" || input.target === "all" ? "/business" : "/");

  const diagnostics = await deliverMarketplaceNotificationsBatch(
    recipients,
    {
      type: "admin_broadcast",
      titleKey: "notifications.adminBroadcast.title",
      bodyKey: "notifications.adminBroadcast.body",
      bodyParams: { title, body },
      href,
    },
    { max: 2000 },
  );

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: historyError } = await (admin as any).from("admin_broadcasts").insert({
    created_by: authUser.id,
    title,
    body,
    target: input.target,
    target_user_id: input.target === "single" ? input.targetUserId ?? null : null,
    href,
    status: diagnostics.deliverySuccess > 0 ? "sent" : "failed",
    sent_at: now,
    delivery_count: diagnostics.deliverySuccess,
  });

  if (historyError) {
    // Delivery may have succeeded — still report counts; history write is secondary.
  }

  await logAdminAction({
    actorId: authUser.id,
    action: "broadcast_sent",
    entityType: "admin_broadcast",
    metadata: {
      target: input.target,
      deliveryCount: diagnostics.deliverySuccess,
      diagnostics,
    },
  });

  revalidatePath("/admin/broadcasts");

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
