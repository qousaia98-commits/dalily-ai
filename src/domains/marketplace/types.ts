import type { JobCheckpointId, MarketplaceLifecyclePhase } from "@/domains/marketplace/lifecycle";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";

/** Attached to read models only when MARKETPLACE_DOMAIN_V2 is enabled. */
export type MarketplaceRequestMeta = {
  /** Target lifecycle phase (mapped from legacy status in Sprint 1). */
  phase: MarketplaceLifecyclePhase;
  /** 1 = legacy RFQ row; 2 = future marketplace-native row. */
  lifecycleVersion: number;
  /** Placeholder for Sprint 4/5 selection aggregate. */
  selectionId: string | null;
  /** Derived light job checkpoint (null if not in job phase). */
  jobCheckpoint: JobCheckpointId | null;
  /** Echo of legacy status for debugging / admin. */
  legacyStatus: ServiceRequestStatus;
  /** Provenance of this meta. */
  source: "legacy_mapped" | "projection";
};

export type MarketplaceSelectionPlaceholder = {
  id: string;
  serviceRequestId: string;
  providerId: string | null;
  offerId: string | null;
  status: "pending_unlock" | "unlocked" | "declined" | "timed_out" | "superseded";
  selectedAt: string;
};
