import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";
import { resolveOrderDisplayStatus } from "@/lib/orders/display-status";

export const CUSTOMER_ORDER_TABS = [
  "pending",
  "accepted",
  "in_progress",
  "waiting",
  "completed",
  "cancelled",
] as const;

export type CustomerOrderTab = (typeof CUSTOMER_ORDER_TABS)[number];

/**
 * Provider “My Jobs” tabs — new opportunities live under /business/opportunities.
 * waiting = awaiting customer confirmation · active = in progress · completed · cancelled
 */
export const PROVIDER_ORDER_TABS = [
  "waiting",
  "active",
  "completed",
  "cancelled",
] as const;

export type ProviderOrderTab = (typeof PROVIDER_ORDER_TABS)[number];

export function customerOrderTab(request: ServiceRequestDetail): CustomerOrderTab {
  const display = resolveOrderDisplayStatus(request);
  switch (display) {
    case "pending":
      return "pending";
    case "accepted":
      return "accepted";
    case "in_progress":
    case "disputed":
      return "in_progress";
    case "waiting":
    case "quoted":
      return "waiting";
    case "completed":
    case "reviewed":
      return "completed";
    case "cancelled":
    case "rejected":
      return "cancelled";
    default:
      return "pending";
  }
}

export function providerOrderTab(request: ServiceRequestDetail): ProviderOrderTab {
  const version = request.lifecycle_version ?? 1;
  if (version >= 2 && !request.provider_id) {
    const display = resolveOrderDisplayStatus(request);
    switch (display) {
      case "waiting":
      case "pending":
      case "quoted":
        return "waiting";
      case "accepted":
      case "in_progress":
      case "disputed":
        return "active";
      case "completed":
      case "reviewed":
        return "completed";
      case "cancelled":
      case "rejected":
        return "cancelled";
      default:
        return "active";
    }
  }

  const status = request.status as ServiceRequestStatus;
  switch (status) {
    case "pending":
    case "quoted":
    case "quote_declined":
      return "waiting";
    case "accepted":
    case "quote_accepted":
    case "in_progress":
    case "completed_by_business":
    case "disputed":
      return "active";
    case "completed":
    case "reviewed":
      return "completed";
    case "rejected":
    case "cancelled":
      return "cancelled";
    default:
      return "waiting";
  }
}

export function countCustomerOrderTabs(
  requests: ServiceRequestDetail[],
): Record<CustomerOrderTab, number> {
  const counts = Object.fromEntries(
    CUSTOMER_ORDER_TABS.map((tab) => [tab, 0]),
  ) as Record<CustomerOrderTab, number>;
  for (const request of requests) {
    counts[customerOrderTab(request)] += 1;
  }
  return counts;
}

export function countProviderOrderTabs(
  requests: ServiceRequestDetail[],
): Record<ProviderOrderTab, number> {
  const counts = Object.fromEntries(
    PROVIDER_ORDER_TABS.map((tab) => [tab, 0]),
  ) as Record<ProviderOrderTab, number>;
  for (const request of requests) {
    counts[providerOrderTab(request)] += 1;
  }
  return counts;
}
