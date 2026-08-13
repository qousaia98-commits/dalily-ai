/**
 * Collect raw fraud signals for an entity (admin client). Soft-fail missing tables.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { FraudRawSignals } from "@/lib/fraud/signals";
import type { RiskEntityType } from "@/lib/fraud/types";

export async function collectEntityFraudRaw(input: {
  entityType: RiskEntityType;
  entityId: string;
}): Promise<FraudRawSignals> {
  const empty: FraudRawSignals = {
    providerCountForOwner: 1,
    customerDuplicateHint: 0,
    failedPaymentCount30d: 0,
    refundRate30d: 0,
    highFakeReviewCount: 0,
    ratingSwing: 0,
    cancelledBookingCount30d: 0,
    noShowCount90d: 0,
    suspiciousMessageFlags: 0,
    accountsCreated24hSameSignal: 0,
    deviceShareCount: 0,
    locationMismatchScore: 0,
    identityChangeCount90d: 0,
    policyViolationCount: 0,
    mlRiskScore: null,
  };

  try {
    const admin = createAdminClient();
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();

    if (input.entityType === "provider") {
      const { data: provider } = await admin
        .from("providers")
        .select("id, owner_id")
        .eq("id", input.entityId)
        .maybeSingle();

      if (provider?.owner_id) {
        const { count } = await admin
          .from("providers")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", provider.owner_id);
        empty.providerCountForOwner = count ?? 1;
      }

      try {
        const { count: cancelled } = await admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", input.entityId)
          .in("status", ["cancelled"])
          .gte("created_at", since30);
        empty.cancelledBookingCount30d = cancelled ?? 0;
      } catch {
        /* optional */
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: fake } = await (admin as any)
          .from("review_ai_analysis")
          .select("review_id", { count: "exact", head: true })
          .gte("fake_risk_score", 0.7);
        empty.highFakeReviewCount = Math.min(fake ?? 0, 10);
      } catch {
        /* optional */
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: qc } = await (admin as any)
          .from("quality_cases")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", input.entityId)
          .eq("category", "policy_violation")
          .is("deleted_at", null);
        empty.policyViolationCount = qc ?? 0;
      } catch {
        /* optional */
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: refunds } = await (admin as any)
          .from("refunds")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", input.entityId)
          .gte("created_at", since30);
        const { count: payments } = await admin
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", input.entityId)
          .gte("created_at", since30);
        const p = payments ?? 0;
        empty.refundRate30d = p > 0 ? (refunds ?? 0) / p : refunds && refunds > 0 ? 1 : 0;
      } catch {
        /* optional */
      }
    }

    if (input.entityType === "customer" || input.entityType === "account") {
      try {
        const { count: cancelled } = await admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", input.entityId)
          .in("status", ["cancelled"])
          .gte("created_at", since30);
        empty.cancelledBookingCount30d = cancelled ?? 0;
      } catch {
        /* optional */
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: failed } = await (admin as any)
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", input.entityId)
          .in("status", ["failed", "requires_payment_method"])
          .gte("created_at", since30);
        empty.failedPaymentCount30d = failed ?? 0;
      } catch {
        /* optional */
      }

      void since90;
    }

    return empty;
  } catch {
    return empty;
  }
}
