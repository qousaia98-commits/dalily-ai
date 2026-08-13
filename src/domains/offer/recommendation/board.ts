/**
 * Server-side loader for the public offer decision board.
 * Never returns weights, raw scores, or internal formulas.
 */

import type { MarketplaceOfferView } from "@/domains/offer/types";
import type { PublicOfferDecisionBoard } from "./types";
import { enrichOfferDecisionSignals } from "./enrich";
import { buildOfferDecisionBoard } from "./engine";
import { getHiringShortlist } from "./shortlist";
import { isOfferDecisionEngineEnabled } from "@/lib/config/feature-flags";

export async function loadOfferDecisionBoardForCustomer(input: {
  requestId: string;
  customerId: string;
  offers: MarketplaceOfferView[];
}): Promise<PublicOfferDecisionBoard | null> {
  if (!isOfferDecisionEngineEnabled()) return null;
  if (input.offers.length === 0) return null;

  const [signalsByOfferId, shortlistedProviderIds] = await Promise.all([
    enrichOfferDecisionSignals(input.offers),
    getHiringShortlist({
      customerId: input.customerId,
      requestId: input.requestId,
    }),
  ]);

  return buildOfferDecisionBoard({
    requestId: input.requestId,
    offers: input.offers,
    signalsByOfferId,
    shortlistedProviderIds,
  });
}
