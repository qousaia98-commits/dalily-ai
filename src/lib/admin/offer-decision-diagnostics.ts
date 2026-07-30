/**
 * Admin-only offer decision diagnostics (public-safe fields + ops flags).
 * Never returns ranking weights or internal formulas.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  enrichOfferDecisionSignals,
  buildOfferDecisionBoard,
} from "@/domains/offer/recommendation";
import { listOffersForRequestAdmin } from "@/domains/offer/recommendation/admin-list";
import { DEFAULT_OFFER_DECISION_WEIGHTS } from "@/domains/offer/recommendation/weights";
import type { PublicOfferDecision } from "@/domains/offer/recommendation";

export type OfferDecisionDiagnosticRow = PublicOfferDecision & {
  providerName: string | null;
  featured: boolean;
  providerStatus: string | null;
};

export type OfferDecisionDiagnostics = {
  requestId: string;
  recommendedOfferId: string | null;
  generatedAt: string;
  rows: OfferDecisionDiagnosticRow[];
  /** Enabled signal keys only — no weights. */
  activeSignalKeys: string[];
};

export async function getOfferDecisionDiagnostics(input: {
  requestId: string;
  actorId: string;
}): Promise<OfferDecisionDiagnostics | null> {
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)) return null;

  const offerList = await listOffersForRequestAdmin(input.requestId);
  if (!offerList.length) return null;

  const signals = await enrichOfferDecisionSignals(offerList);
  const board = await buildOfferDecisionBoard({
    requestId: input.requestId,
    offers: offerList,
    signalsByOfferId: signals,
  });

  const admin = createAdminClient();
  const providerIds = [...new Set(offerList.map((o) => o.providerId))];
  const { data: providers } = await admin
    .from("providers")
    .select("id, is_featured, status")
    .in("id", providerIds);
  const byId = new Map((providers ?? []).map((p) => [p.id as string, p]));

  const activeSignalKeys = DEFAULT_OFFER_DECISION_WEIGHTS.filter((w) => w.enabled).map(
    (w) => w.signalKey,
  );

  const rows: OfferDecisionDiagnosticRow[] = board.decisions.map((d) => {
    const offer = offerList.find((o) => o.id === d.offerId);
    const p = byId.get(d.providerId);
    return {
      ...d,
      providerName: offer?.providerName ?? null,
      featured: Boolean(p?.is_featured),
      providerStatus: (p?.status as string | null) ?? null,
    };
  });

  // actorId reserved for future recommendation-log persistence
  void input.actorId;

  return {
    requestId: input.requestId,
    recommendedOfferId: board.recommendedOfferId,
    generatedAt: board.generatedAt,
    rows,
    activeSignalKeys,
  };
}
