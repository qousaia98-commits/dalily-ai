"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider, requireOwnedProvider } from "@/lib/providers/queries";
import { getPaymentConfig } from "@/lib/payment/config";
import {
  ALLOWED_RECEIPT_TYPES,
  buildPaymentReceiptPath,
  MAX_RECEIPT_BYTES,
  PAYMENT_RECEIPTS_BUCKET,
} from "@/lib/payment/receipt-storage";
import { listActivePlans, getPaymentHistory } from "@/lib/subscription/repository";
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
};

const planSlugSchema = z.enum(["pro", "premium"]);

function revalidate() {
  revalidatePath("/business/subscription");
  revalidatePath("/business/welcome");
  revalidatePath("/business", "layout");
  revalidatePath("/admin/payments");
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

  // Expose pending_payment status to the UI when a payment request is open,
  // while currentPlanSlug stays on the active (Starter) plan until approval.
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
    revalidate();
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

export async function submitPaymentReceiptAction(
  paymentId: string,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  const idParsed = z.string().uuid().safeParse(paymentId);
  if (!idParsed.success) return { success: false, error: "invalid_payment" };

  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "file_required" };
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return { success: false, error: "file_too_large" };
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type as (typeof ALLOWED_RECEIPT_TYPES)[number])) {
    return { success: false, error: "invalid_file_type" };
  }

  const history = await getPaymentHistory(provider.id);
  const payment = history.find((p) => p.id === paymentId);
  if (!payment || payment.paymentStatus !== "pending") {
    return { success: false, error: "payment_not_submittable" };
  }

  const supabase = await createClient();
  const path = buildPaymentReceiptPath(authUser.id, provider.id, paymentId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return { success: false, error: "upload_failed" };

  try {
    await subscriptionService.submitPaymentReceipt(paymentId, provider.id, path, file.type);
  } catch {
    await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).remove([path]);
    return { success: false, error: "save_failed" };
  }

  revalidate();
  return { success: true, message: "pending_review" };
}

export async function downgradeSubscriptionAction(): Promise<SubscriptionActionState> {
  const authUser = await requireAuthUser();
  const provider = await requireOwnedProvider(authUser.id);

  try {
    await subscriptionService.downgrade(provider.id);
    revalidate();
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
    revalidate();
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
    revalidate();
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
