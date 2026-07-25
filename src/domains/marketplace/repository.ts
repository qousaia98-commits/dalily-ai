import { isMarketplaceDomainV2Enabled } from "@/lib/config/feature-flags";
import {
  buildMarketplaceMetaFromLegacy,
  syncMarketplaceRequestProjection,
} from "@/domains/marketplace/projection";
import type { MarketplaceRequestMeta } from "@/domains/marketplace/types";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";

/**
 * Marketplace read repository (Sprint 1).
 * Anti-corruption: always loads via legacy queries; optionally attaches Marketplace meta.
 */
export function attachMarketplaceReadModel(
  detail: ServiceRequestDetail,
): ServiceRequestDetail {
  if (!isMarketplaceDomainV2Enabled()) {
    if (detail.marketplace === undefined) return detail;
    const copy: ServiceRequestDetail = { ...detail };
    delete copy.marketplace;
    return copy;
  }

  const meta: MarketplaceRequestMeta = buildMarketplaceMetaFromLegacy({
    status: detail.status,
    lifecycleVersion: detail.lifecycle_version,
    selectionId: detail.selection_id,
  });

  // Fire-and-forget projection sync (does not block UX).
  void syncMarketplaceRequestProjection({
    serviceRequestId: detail.id,
    legacyStatus: detail.status,
    lifecycleVersion: meta.lifecycleVersion,
    selectionId: meta.selectionId,
    phase: meta.phase,
  });

  return { ...detail, marketplace: meta };
}

export function attachMarketplaceReadModels(
  details: ServiceRequestDetail[],
): ServiceRequestDetail[] {
  if (!isMarketplaceDomainV2Enabled()) {
    return details.map((d) => {
      if (d.marketplace === undefined) return d;
      const copy: ServiceRequestDetail = { ...d };
      delete copy.marketplace;
      return copy;
    });
  }
  return details.map((d) => attachMarketplaceReadModel(d));
}

/** Call after legacy writes when flag is on — keeps projection warm. */
export async function afterLegacyMarketplaceWrite(
  serviceRequestId: string,
  legacyStatus: ServiceRequestDetail["status"],
  opts?: { lifecycleVersion?: number; selectionId?: string | null },
): Promise<void> {
  await syncMarketplaceRequestProjection({
    serviceRequestId,
    legacyStatus,
    lifecycleVersion: opts?.lifecycleVersion,
    selectionId: opts?.selectionId,
  });
}
