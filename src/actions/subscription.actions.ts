"use server";

import { z } from "zod";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider, requireOwnedProvider } from "@/lib/providers/queries";
import { getPaymentConfig } from "@/lib/payment/config";
import {
  buildPaymentReceiptPath,
  isOwnedReceiptPath,
  PAYMENT_RECEIPTS_BUCKET,
  validateReceiptMeta,
} from "@/lib/payment/receipt-storage";
import { listActivePlans, getPaymentHistory } from "@/lib/subscription/repository";
import { revalidateSubscriptionSurfaces } from "@/lib/subscription/revalidate";
import { subscriptionService } from "@/lib/subscription/subscription.service";
import type { PlanSlug } from "@/lib/subscription/types";
import { createClient } from "@/lib/supabase/server";

export type PaymentInstructionsData = {
  paymentId: string;
  planSlug: PlanSlug;
  planLabel: string;
  receiver: string;
  account: string;
  swift?: string;
  bankName?: string;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  hasReceipt: boolean;
};

export type SubscriptionActionState = {
  success: boolean;
  error?: string;
  message?: string;
  paymentInstructions?: PaymentInstructionsData;
  /** Direct-upload prepare payload (never includes file bytes). */
  upload?: {
    path: string;
    token: string;
    signedUrl: string;
  };
};

const planSlugSchema = z.enum(["pro", "premium"]);

const receiptMetaSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(100),
  size: z.number().int().positive(),
});

const receiptConfirmSchema = z.object({
  path: z.string().trim().min(8).max(500),
  mimeType: z.string().trim().min(3).max(100),
  size: z.number().int().positive(),
});

function revalidate(providerSlug?: string | null) {
  revalidateSubscriptionSurfaces({ providerSlug });
}

function planLabelFromSlug(slug: string): string {
  if (slug === "premium") return "PREMIUM";
  if (slug === "pro") return "PRO";
  return "STARTER";
}

export async function getSubscriptionPageData(userId: string) {
  const provider = await getOwnedProvider(userId);
  if (!provider) throw new Error("NO_PROVIDER");

  const [subscription, plans, payments] = await Promise.all([
    subscriptionService.getStatus(provider.id),
    listActivePlans(),
    getPaymentHistory(provider.id),
  ]);

  const openPayment = payments.find(
    (p) => p.paymentStatus === "pending" || p.paymentStatus === "pending_review",
  );

  let pendingPayment: PaymentInstructionsData | null = null;

  if (openPayment) {
    const config = getPaymentConfig();
    pendingPayment = {
      paymentId: openPayment.id,
      planSlug: (openPayment.planSlug ?? "pro") as PlanSlug,
      planLabel: planLabelFromSlug(openPayment.planSlug),
      receiver: config.receiver,
      account: config.account,
      swift: config.swift || undefined,
      bankName: config.bankName || undefined,
      amount: openPayment.amount,
      currency: openPayment.currency,
      reference: openPayment.paymentReference,
      status: openPayment.paymentStatus,
      hasReceipt: Boolean(openPayment.receiptPath),
    };
  }

  const statusForUi = openPayment
    ? "pending_payment"
    : (subscription?.status ?? "active");

  return {
    provider,
    subscription: subscription
      ? { ...subscription, status: statusForUi }
      : subscription,
    plans,
    payments,
    pendingPayment,
  };
}

export async function upgradeSubscriptionAction(
  planSlug: PlanSlug,
  billingCycle: "monthly" | "yearly" = "monthly",
): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  const parsed = planSlugSchema.safeParse(planSlug);
  if (!parsed.success) return { success: false, error: "invalid_plan" };

  try {
    const result = await subscriptionService.upgrade(provider.id, parsed.data, billingCycle);
    const config = getPaymentConfig();
    const instructions = result.payment.instructions;
    revalidate(provider.slug);
    return {
      success: true,
      message: "upgrade_pending",
      paymentInstructions: instructions
        ? {
            paymentId: result.payment.paymentId,
            planSlug: parsed.data,
            planLabel: planLabelFromSlug(parsed.data),
            receiver: instructions.receiver || config.receiver,
            account: instructions.account || config.account,
            swift: instructions.swift || config.swift || undefined,
            bankName: instructions.bankName || config.bankName || undefined,
            amount: instructions.amount,
            currency: instructions.currency,
            reference: instructions.reference,
            status: "pending",
            hasReceipt: false,
          }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "upgrade_failed";
    if (message === "provider_not_approved") {
      return { success: false, error: "provider_not_approved" };
    }
    if (message === "payment_pending" || message === "already_on_plan") {
      return { success: false, error: message };
    }
    return { success: false, error: "upgrade_failed" };
  }
}

/**
 * Step 1: validate metadata + ownership, return a signed upload target.
 * File bytes never enter this action.
 */
export async function preparePaymentReceiptUploadAction(
  paymentId: string,
  meta: { fileName: string; mimeType: string; size: number },
): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  const idParsed = z.string().uuid().safeParse(paymentId);
  const metaParsed = receiptMetaSchema.safeParse(meta);
  if (!idParsed.success || !metaParsed.success) {
    return { success: false, error: "invalid_payment" };
  }

  const validated = validateReceiptMeta(metaParsed.data);
  if (!validated.ok) return { success: false, error: validated.error };

  const history = await getPaymentHistory(provider.id);
  const payment = history.find((p) => p.id === idParsed.data);
  if (!payment || payment.paymentStatus !== "pending") {
    return { success: false, error: "payment_not_submittable" };
  }
  if (payment.receiptPath) {
    return { success: false, error: "duplicate_receipt" };
  }

  const path = buildPaymentReceiptPath(
    authUser.id,
    provider.id,
    idParsed.data,
    metaParsed.data.fileName,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl || !data.token) {
    return { success: false, error: "prepare_failed" };
  }

  return {
    success: true,
    upload: {
      path: data.path || path,
      token: data.token,
      signedUrl: data.signedUrl,
    },
  };
}

/**
 * Step 2: after direct Storage upload, persist path/mime/size only.
 */
export async function confirmPaymentReceiptUploadAction(
  paymentId: string,
  meta: { path: string; mimeType: string; size: number },
): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  const idParsed = z.string().uuid().safeParse(paymentId);
  const metaParsed = receiptConfirmSchema.safeParse(meta);
  if (!idParsed.success || !metaParsed.success) {
    return { success: false, error: "invalid_payment" };
  }

  const validated = validateReceiptMeta({
    fileName: metaParsed.data.path.split("/").pop() || "receipt",
    mimeType: metaParsed.data.mimeType,
    size: metaParsed.data.size,
  });
  if (!validated.ok) return { success: false, error: validated.error };

  if (
    !isOwnedReceiptPath(
      metaParsed.data.path,
      authUser.id,
      provider.id,
      idParsed.data,
    )
  ) {
    return { success: false, error: "invalid_payment" };
  }

  const history = await getPaymentHistory(provider.id);
  const payment = history.find((p) => p.id === idParsed.data);
  if (!payment || payment.paymentStatus !== "pending") {
    return { success: false, error: "payment_not_submittable" };
  }
  if (payment.receiptPath) {
    return { success: false, error: "duplicate_receipt" };
  }

  // Owner has no SELECT on receipts — verify object exists via admin client.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .createSignedUrl(metaParsed.data.path, 60);

  if (!signed?.signedUrl) {
    return { success: false, error: "upload_failed" };
  }

  try {
    await subscriptionService.submitPaymentReceipt(
      idParsed.data,
      provider.id,
      metaParsed.data.path,
      validated.mimeType,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "duplicate_receipt") {
      return { success: false, error: "duplicate_receipt" };
    }
    return { success: false, error: "save_failed" };
  }

  revalidate(provider.slug);
  return { success: true, message: "pending_review" };
}

/**
 * @deprecated File bodies must not go through Server Actions.
 * Use preparePaymentReceiptUploadAction + confirmPaymentReceiptUploadAction.
 */
export async function submitPaymentReceiptAction(): Promise<SubscriptionActionState> {
  return { success: false, error: "use_direct_upload" };
}

export async function downgradeSubscriptionAction(): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  try {
    await subscriptionService.downgrade(provider.id);
    revalidate(provider.slug);
    return { success: true, message: "downgraded" };
  } catch {
    return { success: false, error: "downgrade_failed" };
  }
}

export async function cancelSubscriptionAction(): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  try {
    await subscriptionService.cancel(provider.id);
    revalidate(provider.slug);
    return { success: true, message: "cancelled" };
  } catch {
    return { success: false, error: "cancel_failed" };
  }
}

export async function renewSubscriptionAction(): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  try {
    const before = await subscriptionService.getStatus(provider.id);
    const result = await subscriptionService.renew(provider.id);
    const config = getPaymentConfig();
    const instructions = result.payment.instructions;
    const slug = (before?.planSlug ?? "pro") as PlanSlug;
    revalidate(provider.slug);
    return {
      success: true,
      message: "renew_pending",
      paymentInstructions: instructions
        ? {
            paymentId: result.payment.paymentId,
            planSlug: slug === "free" ? "pro" : slug,
            planLabel: planLabelFromSlug(slug),
            receiver: instructions.receiver || config.receiver,
            account: instructions.account || config.account,
            swift: instructions.swift || config.swift || undefined,
            bankName: instructions.bankName || config.bankName || undefined,
            amount: instructions.amount,
            currency: instructions.currency,
            reference: instructions.reference,
            status: "pending",
            hasReceipt: false,
          }
        : undefined,
    };
  } catch {
    return { success: false, error: "renew_failed" };
  }
}
