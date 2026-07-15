"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider, requireOwnedProvider } from "@/lib/providers/queries";
import { getPaymentConfig } from "@/lib/payment/config";
import { listActivePlans, getPaymentHistory } from "@/lib/subscription/repository";
import { subscriptionService } from "@/lib/subscription/subscription.service";
import type { PlanSlug } from "@/lib/subscription/types";

export type PaymentInstructionsData = {
  receiver: string;
  account: string;
  amount: number;
  currency: string;
  reference: string;
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
}

function buildPendingInstructions(
  subscriptionId: string | undefined,
  payments: Awaited<ReturnType<typeof getPaymentHistory>>,
): PaymentInstructionsData | null {
  const pending = payments.find((p) => p.paymentStatus === "pending");
  if (!pending || !subscriptionId) return null;

  const config = getPaymentConfig();
  return {
    receiver: config.receiver,
    account: config.account,
    amount: pending.amount,
    currency: pending.currency,
    reference: `SUB-${subscriptionId.slice(0, 8).toUpperCase()}`,
  };
}

export async function getSubscriptionPageData(userId: string) {
  const provider = await getOwnedProvider(userId);
  if (!provider) throw new Error("NO_PROVIDER");

  const [subscription, plans, payments] = await Promise.all([
    subscriptionService.getStatus(provider.id),
    listActivePlans(),
    getPaymentHistory(provider.id),
  ]);

  const pendingPayment =
    subscription?.status === "pending_payment"
      ? buildPendingInstructions(subscription.id, payments)
      : null;

  return { provider, subscription, plans, payments, pendingPayment };
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
    revalidate();
    return {
      success: true,
      message: "upgrade_pending",
      paymentInstructions: result.payment.instructions,
    };
  } catch {
    return { success: false, error: "upgrade_failed" };
  }
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
    const result = await subscriptionService.renew(provider.id);
    revalidate();
    return {
      success: true,
      message: "renew_pending",
      paymentInstructions: result.payment.instructions,
    };
  } catch {
    return { success: false, error: "renew_failed" };
  }
}
