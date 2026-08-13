"use server";

import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  isProviderMonetizationEnabled,
  isUnlockPaymentsV2Enabled,
} from "@/lib/config/feature-flags";
import {
  getPaymentById,
  listProviderPayments,
} from "@/lib/payment/orchestration";
import type {
  PaymentLifecycleStatus,
  PaymentPurpose,
  PaymentRecord,
} from "@/lib/payment/canonical-types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_RECEIPTS_BUCKET } from "@/lib/payment/receipt-storage";

export type PaymentHistoryFilters = {
  purpose?: PaymentPurpose | "all" | "lead_unlock";
  status?: PaymentLifecycleStatus | "all";
  query?: string;
  /** YYYY-MM or "current" | "previous" | "all" */
  month?: string;
};

function monthRange(month: string | undefined): {
  from?: string;
  to?: string;
} {
  if (!month || month === "all") return {};
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  if (month === "previous") {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  } else if (month !== "current" && /^\d{4}-\d{2}$/.test(month)) {
    const [ys, ms] = month.split("-");
    y = Number(ys);
    m = Number(ms) - 1;
  } else if (month !== "current") {
    return {};
  }
  const from = new Date(Date.UTC(y, m, 1)).toISOString();
  const to = new Date(Date.UTC(y, m + 1, 1)).toISOString();
  return { from, to };
}

export async function listMyPaymentHistoryAction(
  filters: PaymentHistoryFilters = {},
): Promise<
  | { ok: true; payments: PaymentRecord[] }
  | { ok: false; error: string }
> {
  if (!isUnlockPaymentsV2Enabled() && !isProviderMonetizationEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };

  const range = monthRange(filters.month ?? "all");
  const payments = await listProviderPayments({
    providerId: provider.id,
    purpose: filters.purpose ?? "all",
    status: filters.status ?? "all",
    query: filters.query,
    from: range.from ?? null,
    to: range.to ?? null,
    limit: 200,
  });

  void emitAiLearningEvent({
    eventType: "payment_history_viewed",
    providerId: provider.id,
    metadata: { anonymized: true, count: payments.length },
  });

  return { ok: true, payments };
}

export async function getPaymentReceiptDownloadUrlAction(
  paymentId: string,
): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };

  const payment = await getPaymentById(paymentId);
  if (!payment || payment.providerId !== provider.id) {
    return { ok: false, error: "not_found" };
  }
  if (!payment.receiptPath) {
    return { ok: false, error: "no_receipt" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .createSignedUrl(payment.receiptPath, 120);

  if (error || !data?.signedUrl) {
    return { ok: false, error: "download_failed" };
  }

  void emitAiLearningEvent({
    eventType: "payment_receipt_downloaded",
    providerId: provider.id,
    metadata: { anonymized: true },
  });

  return { ok: true, url: data.signedUrl };
}
