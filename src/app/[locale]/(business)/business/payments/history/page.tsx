import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  isProviderMonetizationEnabled,
  isRefundsDisputesEnabled,
  isUnlockPaymentsV2Enabled,
} from "@/lib/config/feature-flags";
import { listProviderPayments } from "@/lib/payment/orchestration";
import { listFinancialDocuments } from "@/lib/financial-documents";
import { listDisputes, listRefunds } from "@/lib/refunds";
import { PaymentHistoryPanel } from "@/components/business/payment-history-panel";
import { FinancialDocumentsPanel } from "@/components/business/financial-documents-panel";
import { ProviderRefundsPanel } from "@/components/business/provider-refunds-panel";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export default async function BusinessPaymentHistoryPage() {
  if (!isUnlockPaymentsV2Enabled() && !isProviderMonetizationEnabled()) {
    redirect("/business/payments");
  }

  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) redirect("/business");

  const refundsEnabled = isRefundsDisputesEnabled();

  const [payments, documents, refunds, disputes] = await Promise.all([
    listProviderPayments({
      providerId: provider.id,
      limit: 100,
    }),
    listFinancialDocuments({ providerId: provider.id, limit: 100 }),
    refundsEnabled
      ? listRefunds({ providerId: provider.id, limit: 100 })
      : Promise.resolve([]),
    refundsEnabled
      ? listDisputes({ providerId: provider.id, limit: 50 })
      : Promise.resolve([]),
  ]);

  void emitAiLearningEvent({
    eventType: "payment_history_viewed",
    providerId: provider.id,
    metadata: { anonymized: true, count: payments.length },
  });

  const paidPayments = payments.filter(
    (p) =>
      p.status === "paid" &&
      p.refundStatus !== "full" &&
      p.refundedAmount < p.amount - 1e-9,
  );

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 animate-fade-in">
      <PaymentHistoryPanel initialPayments={payments} />
      <FinancialDocumentsPanel initialDocuments={documents} />
      {refundsEnabled ? (
        <ProviderRefundsPanel
          initialRefunds={refunds}
          initialDisputes={disputes}
          paidPayments={paidPayments}
        />
      ) : null}
    </main>
  );
}
