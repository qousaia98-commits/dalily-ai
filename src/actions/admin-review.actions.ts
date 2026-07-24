"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAudit } from "@/lib/admin/audit";
import {
  sendBusinessApprovedEmail,
  sendBusinessChangesRequestedEmail,
  sendBusinessRejectedEmail,
} from "@/lib/email/dalily-email";
import { getProviderOwnerEmailContext } from "@/lib/email/provider-email-context";
import { ensureFreeSubscription } from "@/lib/subscription/repository";
import {
  serializeVerificationFeedback,
  type VerificationAdminFeedback,
} from "@/lib/verification/feedback";
import { notifyProviderVerificationEvent } from "@/lib/verification/notify";

export type AdminReviewActionState = {
  success: boolean;
  error?: string;
};

function forbidden(): AdminReviewActionState {
  return { success: false, error: "forbidden" };
}

function revalidateReview(providerId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/providers");
  revalidatePath(`/admin/providers/${providerId}`);
  revalidatePath("/admin/verification");
  revalidatePath("/business");
  revalidatePath("/business/verification");
  revalidatePath("/business/profile");
  revalidatePath("/search");
}

const idSchema = z.string().uuid();
const noteSchema = z.string().trim().min(3).max(1000);
const optionalNoteSchema = z.string().trim().max(1000).optional().or(z.literal(""));

function normalizeFeedback(
  input: VerificationAdminFeedback | string,
): VerificationAdminFeedback | null {
  if (typeof input === "string") {
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return null;
    return { reason: parsed.data };
  }
  const reason = noteSchema.safeParse(input.reason);
  if (!reason.success) return null;
  const note = optionalNoteSchema.safeParse(input.note ?? "");
  const recommendation = optionalNoteSchema.safeParse(input.recommendation ?? "");
  return {
    reason: reason.data,
    ...(note.success && note.data ? { note: note.data } : {}),
    ...(recommendation.success && recommendation.data
      ? { recommendation: recommendation.data }
      : {}),
  };
}

export async function approveBusinessAction(
  providerId: string,
): Promise<AdminReviewActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parsed = idSchema.safeParse(providerId);
  if (!parsed.success) return { success: false, error: "validation_error" };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("providers")
    .update({
      status: "active",
      verification_status: "verified",
      published_at: now,
      admin_review_note: null,
      changes_requested_at: null,
      updated_by: authUser.id,
    })
    .eq("id", parsed.data);

  if (error) return { success: false, error: "update_failed" };

  await admin
    .from("provider_verifications")
    .update({
      status: "approved",
      rejection_reason: null,
      reviewed_by: authUser.id,
      reviewed_at: now,
    })
    .eq("provider_id", parsed.data)
    .eq("status", "pending");

  await ensureFreeSubscription(parsed.data);

  const owner = await getProviderOwnerEmailContext(parsed.data);
  if (owner?.email) {
    await sendBusinessApprovedEmail({
      to: owner.email,
      businessName: owner.businessName,
      locale: owner.locale,
    });
  }
  if (owner?.ownerId) {
    await notifyProviderVerificationEvent({
      ownerId: owner.ownerId,
      kind: "approved",
    });
  }

  await logAdminAudit({
    actorId: authUser.id,
    action: "provider_approved",
    entityType: "provider",
    entityId: parsed.data,
  });

  revalidateReview(parsed.data);
  return { success: true };
}

export async function requestBusinessChangesAction(
  providerId: string,
  feedbackInput: VerificationAdminFeedback | string,
): Promise<AdminReviewActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parsedId = idSchema.safeParse(providerId);
  const feedback = normalizeFeedback(feedbackInput);
  if (!parsedId.success || !feedback) {
    return { success: false, error: "validation_error" };
  }

  const serialized = serializeVerificationFeedback(feedback);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("providers")
    .update({
      status: "changes_requested",
      admin_review_note: serialized,
      changes_requested_at: now,
      updated_by: authUser.id,
    })
    .eq("id", parsedId.data);

  if (error) return { success: false, error: "update_failed" };

  const owner = await getProviderOwnerEmailContext(parsedId.data);
  if (owner?.email) {
    await sendBusinessChangesRequestedEmail({
      to: owner.email,
      businessName: owner.businessName,
      note: feedback.reason,
      locale: owner.locale,
    });
  }
  if (owner?.ownerId) {
    await notifyProviderVerificationEvent({
      ownerId: owner.ownerId,
      kind: "changes_requested",
      feedback,
    });
  }

  await logAdminAudit({
    actorId: authUser.id,
    action: "provider_changes_requested",
    entityType: "provider",
    entityId: parsedId.data,
    metadata: { note: feedback.reason, feedback },
  });

  revalidateReview(parsedId.data);
  return { success: true };
}

export async function rejectBusinessAction(
  providerId: string,
  feedbackInput: VerificationAdminFeedback | string,
): Promise<AdminReviewActionState> {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) return forbidden();

  const parsedId = idSchema.safeParse(providerId);
  const feedback = normalizeFeedback(feedbackInput);
  if (!parsedId.success || !feedback) {
    return { success: false, error: "validation_error" };
  }

  const serialized = serializeVerificationFeedback(feedback);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("providers")
    .update({
      status: "draft",
      verification_status: "rejected",
      admin_review_note: serialized,
      changes_requested_at: null,
      updated_by: authUser.id,
    })
    .eq("id", parsedId.data);

  if (error) return { success: false, error: "update_failed" };

  await admin
    .from("provider_verifications")
    .update({
      status: "rejected",
      rejection_reason: serialized,
      reviewed_by: authUser.id,
      reviewed_at: now,
    })
    .eq("provider_id", parsedId.data);

  const owner = await getProviderOwnerEmailContext(parsedId.data);
  if (owner?.email) {
    await sendBusinessRejectedEmail({
      to: owner.email,
      businessName: owner.businessName,
      reason: feedback.reason,
      locale: owner.locale,
    });
  }
  if (owner?.ownerId) {
    await notifyProviderVerificationEvent({
      ownerId: owner.ownerId,
      kind: "rejected",
      feedback,
    });
  }

  await logAdminAudit({
    actorId: authUser.id,
    action: "provider_rejected",
    entityType: "provider",
    entityId: parsedId.data,
    metadata: { reason: feedback.reason, feedback },
  });

  revalidateReview(parsedId.data);
  return { success: true };
}
