"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { logAdminAudit } from "@/lib/admin/audit";
import { requireOwnedProvider } from "@/lib/providers/queries";
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

export type VerificationActionState = {
  success: boolean;
  error?: string;
  message?: string;
};

const docTypeSchema = z.enum(["id_front", "id_back", "selfie"]);

async function revalidateVerificationPaths() {
  revalidatePath("/business/verification");
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

  if (!ALLOWED_VERIFICATION_TYPES.includes(file.type as (typeof ALLOWED_VERIFICATION_TYPES)[number])) {
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
  const path = buildVerificationStoragePath(authUser.id, provider.id, docType, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PROVIDER_VERIFICATION_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

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

    const updateResult =
      docType === "id_front"
        ? await supabase
            .from("provider_verifications")
            .update({ id_front_url: path })
            .eq("provider_id", provider.id)
        : docType === "id_back"
          ? await supabase
              .from("provider_verifications")
              .update({ id_back_url: path })
              .eq("provider_id", provider.id)
          : await supabase
              .from("provider_verifications")
              .update({ selfie_url: path })
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

  if (verification.status === "pending" && provider.status === "pending_review") {
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
      updated_by: authUser.id,
    })
    .eq("id", provider.id);

  if (providerError) return { success: false, error: "submit_failed" };

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
  });

  if (!parsed.success) return validationError();

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
      rejection_reason: parsed.data.rejectionReason,
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
      updated_by: authUser.id,
    })
    .eq("id", parsed.data.providerId);

  if (providerError) return { success: false, error: "reject_failed" };

  const owner = await getProviderOwnerEmailContext(parsed.data.providerId);
  if (owner?.email) {
    await sendBusinessRejectedEmail({
      to: owner.email,
      businessName: owner.businessName,
      reason: parsed.data.rejectionReason,
      locale: owner.locale,
    });
  }

  await logAdminAudit({
    actorId: authUser.id,
    action: "provider_rejected",
    entityType: "provider",
    entityId: parsed.data.providerId,
    metadata: {
      verificationId: verification.id,
      rejectionReason: parsed.data.rejectionReason,
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
