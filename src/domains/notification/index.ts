/**
 * SAD Notification domain facade (Sprint 0).
 */

export const NOTIFICATION_DOMAIN = {
  service: "notification",
  owns: ["notification_requests", "delivery_attempts"],
  impl: ["src/lib/notifications", "src/lib/business/notification-inbox"],
  status: "facade",
} as const;

export {
  deliverMarketplaceNotification,
  deliverMarketplaceNotificationsBatch,
  type MarketplaceNotifyInput,
  type MarketplaceDeliveryResult,
  type BroadcastDeliveryDiagnostics,
} from "@/lib/notifications/deliver";
