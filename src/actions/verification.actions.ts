"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { logAdminAudit } from "@/lib/admin/audit";
import { requireOwnedProvider } from "@/lib/providers/database";
import {
  ALLOWED_VERIFICATION_TYPES,
  MAX_VERIFICATION_BYTES,
  type VerificationDocType,
} from "@/lib/verification/constants";
import {
  buildVerificationStoragePath,
  PROVIDER_VERIFICATION_BUCKET,
} from "@/lib/verification/storage";
import {
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
} from "@/lib/email/dalily-email";
import { getProviderOwnerEmailContext } from "@/lib/email/provider-email-context";
import { ensureFreeSubscription } from "@/lib/subscription/repository";
import {
  getProviderVerificationForOwner,
  isVerificationComplete,
} from "@/lib/verification/queries";
import { getApprovalReadiness } from "@/lib/providers/approval-readiness";
import {
  serializeVerificationFeedback,
  type VerificationAdminFeedback,
} from "@/lib/verification/feedback";
import { notifyProviderVerificationEvent } from "@/lib/verification/notify";

export type VerificationActionState = {
  success: boolean;
  error?: string;
  message?: string;
};

const docTypeSchema = z.enum(["id_front", "id_back", "selfie"]);

async function revalidateVerificationPaths() {
  revalidatePath("/business/verification");
  revalidatePath("/business");
  revalidatePath("/admin/verification");
  revalidatePath("/search");
  revalidatePath("/", "layout");
}

function validationError(): VerificationActionState {
  return { success: false, error: "validation_error" };
}

export async function uploadVerificationDocumentAction(
  _prev: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = docTypeSchema.safeParse(formData.get("docType"));
  if (!parsed.success) return validationError();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "file_required" };
  }

  if (file.size > MAX_VERIFICATION_BYTES) {
    return { success: false, error: "file_too_large" };
  }

  // Normalize MIME — some browsers send empty type or image/jpg after canvas encode.
  const normalizedType =
    !file.type || file.type === "image/jpg"
      ? "image/jpeg"
      : file.type;

  if (!ALLOWED_VERIFICATION_TYPES.includes(normalizedType as (typeof ALLOWED_VERIFICATION_TYPES)[number])) {
    return { success: false, error: "invalid_file_type" };
  }

  const existing = await getProviderVerificationForOwner(provider.id);
  if (existing?.status === "approved") {
    return { success: false, error: "already_approved" };
  }

  if (
    existing?.status === "pending" &&
    provider.status === "pending_review" &&
    isVerificationComplete(existing)
  ) {
    return { success: false, error: "already_submitted" };
  }

  const docType = parsed.data as VerificationDocType;
  const supabase = await createClient();
  const safeName = file.name?.trim() || `${docType}.jpg`;
  const path = buildVerificationStoragePath(authUser.id, provider.id, docType, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PROVIDER_VERIFICATION_BUCKET)
    .upload(path, buffer, { contentType: normalizedType, upsert: false });

  if (uploadError) return { success: false, error: "upload_failed" };

  if (!existing) {
    const insertResult =
      docType === "id_front"
        ? await supabase.from("provider_verifications").insert({
            provider_id: provider.id,
            id_front_url: path,
          })
        : docType === "id_back"
          ? await supabase.from("provider_verifications").insert({
              provider_id: provider.id,
              id_back_url: path,
            })
          : await supabase.from("provider_verifications").insert({
              provider_id: provider.id,
              selfie_url: path,
            });

    const insertError = insertResult.error;

    if (insertError) {
      await supabase.storage.from(PROVIDER_VERIFICATION_BUCKET).remove([path]);
      return { success: false, error: "save_failed" };
    }
  } else {
    const oldPath =
      docType === "id_front"
        ? existing.id_front_url
        : docType === "id_back"
          ? existing.id_back_url
          : existing.selfie_url;

    // After rejection, new uploads must return the row to pending (RLS + resubmit UX).
    const resetAfterReject =
      existing.status === "rejected"
        ? {
            status: "pending" as const,
            rejection_reason: null,
            reviewed_at: null,
            reviewed_by: null,
          }
        : {};

    const updateResult =
      docType === "id_front"
        ? await supabase
            .from("provider_verifications")
            .update({ id_front_url: path, ...resetAfterReject })
            .eq("provider_id", provider.id)
        : docType === "id_back"
          ? await supabase
              .from("provider_verifications")
              .update({ id_back_url: path, ...resetAfterReject })
              .eq("provider_id", provider.id)
          : await supabase
              .from("provider_verifications")
              .update({ selfie_url: path, ...resetAfterReject })
              .eq("provider_id", provider.id);

    const updateError = updateResult.error;

    if (updateError) {
      await supabase.storage.from(PROVIDER_VERIFICATION_BUCKET).remove([path]);
      return { success: false, error: "save_failed" };
    }

    if (oldPath) {
      await supabase.storage.from(PROVIDER_VERIFICATION_BUCKET).remove([oldPath]);
    }
  }

  await revalidateVerificationPaths();
  return { success: true, message: "uploaded" };
}

export async function submitVerificationAction(): Promise<VerificationActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);
  const readiness = await getApprovalReadiness(provider);

  if (!readiness.hasIdDocument) {
    return { success: false, error: "documents_incomplete" };
  }

  const verification = await getProviderVerificationForOwner(provider.id);

  if (!verification || !isVerificationComplete(verification)) {
    return { success: false, error: "documents_incomplete" };
  }

  if (verification.status === "approved") {
    return { success: false, error: "already_approved" };
  }

  // Allow resubmit after rejection even when provider.status is still pending_review.
  if (
    verification.status === "pending" &&
    provider.status === "pending_review" &&
    provider.verificationStatus !== "rejected"
  ) {
    return { success: false, error: "already_submitted" };
  }

  const supabase = await createClient();
  const { error: verificationError } = await supabase
    .from("provider_verifications")
    .update({
      status: "pending",
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("provider_id", provider.id);

  if (verificationError) return { success: false, error: "submit_failed" };

  const { error: providerError } = await supabase
    .from("providers")
    .update({
      status: "pending_review",
      verification_status: "pending",
      admin_review_note: null,
      changes_requested_at: null,
      updated_by: authUser.id,
    })
    .eq("id", provider.id);

  if (providerError) return { success: false, error: "submit_failed" };

  await notifyProviderVerificationEvent({
    ownerId: authUser.id,
    kind: "resubmitted",
  });

  await revalidateVerificationPaths();
  return { success: true, message: "submitted" };
}

export async function approveVerificationAction(
  providerId: string,
): Promise<VerificationActionState> {
  const authUser = await requireAuthUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { success: false, error: "forbidden" };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: verification, error: fetchError } = await admin
    .from("provider_verifications")
    .select("*")
    .eq("provider_id", providerId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !verification) {
    return { success: false, error: "not_found" };
  }

  const { error: verificationError } = await admin
    .from("provider_verifications")
    .update({
      status: "approved",
      rejection_reason: null,
      reviewed_by: authUser.id,
      reviewed_at: now,
    })
    .eq("id", verification.id);

  if (verificationError) return { success: false, error: "approve_failed" };

  const { error: providerError } = await admin
    .from("providers")
    .update({
      status: "active",
      verification_status: "verified",
      published_at: now,
      updated_by: authUser.id,
    })
    .eq("id", providerId);

  if (providerError) return { success: false, error: "approve_failed" };

  await ensureFreeSubscription(providerId);

  const owner = await getProviderOwnerEmailContext(providerId);
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
    entityId: providerId,
    metadata: { verificationId: verification.id },
  });

  await revalidateVerificationPaths();
  revalidatePath("/business/subscription");
  revalidatePath("/business", "layout");
  return { success: true, message: "approved" };
}

const rejectSchema = z.object({
  providerId: z.string().uuid(),
  rejectionReason: z.string().trim().min(3).max(500),
  additionalNote: z.string().trim().max(1000).optional(),
  recommendation: z.string().trim().max(1000).optional(),
});

export async function rejectVerificationAction(
  _prev: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  const authUser = await requireAuthUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { success: false, error: "forbidden" };
  }

  const parsed = rejectSchema.safeParse({
    providerId: formData.get("providerId"),
    rejectionReason: formData.get("rejectionReason"),
    additionalNote: formData.get("additionalNote") || undefined,
    recommendation: formData.get("recommendation") || undefined,
  });

  if (!parsed.success) return validationError();

  const feedback: VerificationAdminFeedback = {
    reason: parsed.data.rejectionReason,
    ...(parsed.data.additionalNote
      ? { note: parsed.data.additionalNote }
      : {}),
    ...(parsed.data.recommendation
      ? { recommendation: parsed.data.recommendation }
      : {}),
  };
  const serialized = serializeVerificationFeedback(feedback);

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: verification, error: fetchError } = await admin
    .from("provider_verifications")
    .select("id")
    .eq("provider_id", parsed.data.providerId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !verification) {
    return { success: false, error: "not_found" };
  }

  const { error: verificationError } = await admin
    .from("provider_verifications")
    .update({
      status: "rejected",
      rejection_reason: serialized,
      reviewed_by: authUser.id,
      reviewed_at: now,
    })
    .eq("id", verification.id);

  if (verificationError) return { success: false, error: "reject_failed" };

  const { error: providerError } = await admin
    .from("providers")
    .update({
      status: "pending_review",
      verification_status: "rejected",
      admin_review_note: serialized,
      updated_by: authUser.id,
    })
    .eq("id", parsed.data.providerId);

  if (providerError) return { success: false, error: "reject_failed" };

  const owner = await getProviderOwnerEmailContext(parsed.data.providerId);
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
    entityId: parsed.data.providerId,
    metadata: {
      verificationId: verification.id,
      rejectionReason: feedback.reason,
      feedback,
    },
  });

  await revalidateVerificationPaths();
  return { success: true, message: "rejected" };
}

export async function getVerificationDocumentUrlAction(
  path: string,
): Promise<{ url: string | null; error?: string }> {
  const authUser = await requireAuthUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { url: null, error: "forbidden" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PROVIDER_VERIFICATION_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return { url: null, error: "url_failed" };
  }

  return { url: data.signedUrl };
}
