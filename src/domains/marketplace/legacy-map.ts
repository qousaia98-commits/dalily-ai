import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import type { MarketplaceLifecyclePhase } from "@/domains/marketplace/lifecycle";
import type { JobCheckpointId } from "@/domains/marketplace/lifecycle";

/**
 * Anti-corruption: map legacy accept→chat RFQ statuses into Marketplace phases.
 * This does NOT change chat/payment rules — legacy canChat() remains authoritative until Sprint 7.
 */
export function mapLegacyStatusToLifecyclePhase(
  status: ServiceRequestStatus,
  opts?: { lifecycleVersion?: number; providerId?: string | null },
): MarketplaceLifecyclePhase {
  const version = opts?.lifecycleVersion ?? 1;
  const unassigned = version >= 2 && !opts?.providerId;

  if (unassigned) {
    switch (status) {
      case "pending":
        return "matching";
      case "cancelled":
        return "cancelled";
      case "rejected":
        return "rejected";
      default:
        break;
    }
  }

  switch (status) {
    case "pending":
      // Legacy: already routed to a single provider (directory RFQ). Closest v2 phase: offering wait.
      return "offering";
    case "accepted":
      return "unlocked";
    case "quoted":
      return "offering";
    case "quote_accepted":
      return "selected";
    case "quote_declined":
      return "offering";
    case "in_progress":
      return "in_progress";
    case "completed_by_business":
      return "completed";
    case "completed":
      return "completed";
    case "reviewed":
      return "reviewed";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "disputed":
      return "disputed";
    default:
      return "published";
  }
}

export function mapLifecyclePhaseToJobCheckpoint(
  phase: MarketplaceLifecyclePhase,
): JobCheckpointId | null {
  switch (phase) {
    case "unlocked":
    case "selected":
    case "unlock_pending":
      return "confirmed";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "done_pending_customer";
    case "reviewed":
      return "closed";
    default:
      return null;
  }
}

/**
 * Architectural note (Sprint 1 decision):
 * Legacy `pending` is NOT `published`+`matching` because today's product assigns a provider at create time.
 * True published→matching appears when Sprint 2/3 intent flow lands.
 */
