import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";

/**
 * Shared order display keys — customer and provider must render the same
 * current state for a given request (i18n under `orders.status.*`).
 */
export type OrderDisplayStatus =
  | "pending"
  | "waiting"
  | "accepted"
  | "quoted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected"
  | "disputed"
  | "reviewed";

/**
 * Resolve the product-facing status both roles should see.
 * Marketplace-native requests stay on DB status `pending` while matching/offers
 * run — surface that as `waiting`, not a stuck "Pending".
 * After unlock, status advances to in_progress / completed_* without provider_id.
 */
export function resolveOrderDisplayStatus(
  request: Pick<
    ServiceRequestDetail,
    "status" | "lifecycle_version" | "provider_id" | "selection_id" | "quote"
  >,
): OrderDisplayStatus {
  const version = request.lifecycle_version ?? 1;
  const marketplaceNative = version >= 2 && !request.provider_id;

  if (marketplaceNative && request.status === "pending") {
    if (request.selection_id) return "accepted";
    return "waiting";
  }

  switch (request.status as ServiceRequestStatus) {
    case "pending":
      return "pending";
    case "accepted":
      return "accepted";
    case "quoted":
      return "quoted";
    case "quote_accepted":
    case "in_progress":
      return "in_progress";
    case "completed_by_business":
      // Work done by provider — customer confirmation still pending.
      return "in_progress";
    case "quote_declined":
      return "waiting";
    case "completed":
      return "completed";
    case "reviewed":
      return "reviewed";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "rejected";
    case "disputed":
      return "disputed";
    default:
      return "pending";
  }
}
