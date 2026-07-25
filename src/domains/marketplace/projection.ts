import { createClient } from "@/lib/supabase/server";
import { isMarketplaceDomainV2Enabled } from "@/lib/config/feature-flags";
import type { MarketplaceLifecyclePhase } from "@/domains/marketplace/lifecycle";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import {
  mapLegacyStatusToLifecyclePhase,
  mapLifecyclePhaseToJobCheckpoint,
} from "@/domains/marketplace/legacy-map";
import type { MarketplaceRequestMeta } from "@/domains/marketplace/types";

export function buildMarketplaceMetaFromLegacy(input: {
  status: ServiceRequestStatus;
  lifecycleVersion?: number | null;
  selectionId?: string | null;
}): MarketplaceRequestMeta {
  const phase = mapLegacyStatusToLifecyclePhase(input.status);
  return {
    phase,
    lifecycleVersion: input.lifecycleVersion ?? 1,
    selectionId: input.selectionId ?? null,
    jobCheckpoint: mapLifecyclePhaseToJobCheckpoint(phase),
    legacyStatus: input.status,
    source: "legacy_mapped",
  };
}

/**
 * Best-effort projection upsert. Never throws to callers — storage is additive prep.
 * Safe when migration not applied yet (errors swallowed).
 */
export async function syncMarketplaceRequestProjection(input: {
  serviceRequestId: string;
  legacyStatus: ServiceRequestStatus;
  lifecycleVersion?: number;
  selectionId?: string | null;
  phase?: MarketplaceLifecyclePhase;
}): Promise<void> {
  if (!isMarketplaceDomainV2Enabled()) return;

  const phase = input.phase ?? mapLegacyStatusToLifecyclePhase(input.legacyStatus);
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("marketplace_request_projections").upsert(
      {
        service_request_id: input.serviceRequestId,
        lifecycle_phase: phase,
        legacy_status: input.legacyStatus,
        selection_id: input.selectionId ?? null,
        lifecycle_version: input.lifecycleVersion ?? 1,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "service_request_id" },
    );
    if (error) {
      // Table may not exist yet locally — ignore.
      return;
    }
  } catch {
    return;
  }
}
