/**
 * SAD Notification domain facade (Sprint 0 + Sprint 5 Phase 6).
 */

export const NOTIFICATION_DOMAIN = {
  service: "notification",
  owns: [
    "marketplace_notifications",
    "smart_notifications",
    "notification_preferences",
    "notification_delivery_attempts",
    "notification_digests",
    "notification_push_subscriptions",
  ],
  impl: ["src/lib/notifications", "src/lib/business/notification-inbox"],
  status: "active",
} as const;

export * from "@/lib/notifications";
