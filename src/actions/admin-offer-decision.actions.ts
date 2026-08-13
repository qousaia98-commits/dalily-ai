"use server";

import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { getOfferDecisionDiagnostics } from "@/lib/admin/offer-decision-diagnostics";
import type { OfferDecisionDiagnostics } from "@/lib/admin/offer-decision-diagnostics";
import { isOfferDecisionEngineEnabled } from "@/lib/config/feature-flags";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export async function loadOfferDecisionDiagnosticsAction(
  requestId: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: OfferDecisionDiagnostics;
}> {
  if (!isOfferDecisionEngineEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { success: false, error: "forbidden" };
  }

  const rate = checkRateLimit(
    rateLimitKey("admin_offer_decision", authUser.id),
    { max: 20, windowMs: 60_000 },
  );
  if (!rate.ok) return { success: false, error: "rate_limited" };

  const data = await getOfferDecisionDiagnostics({
    requestId,
    actorId: authUser.id,
  });
  if (!data) return { success: false, error: "not_found" };
  return { success: true, data };
}
