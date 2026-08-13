/**
 * Sprint 5 Phase 6 — Smart Notification Center public API.
 */

export type {
  NotifPriority,
  NotifCategory,
  NotifStatus,
  NotifChannel,
  NotifDigestKind,
  NotifActionKey,
  SmartNotification,
  NotificationPreferences,
  NotificationDigest,
  CreateSmartNotificationInput,
} from "./types";

export {
  deliverMarketplaceNotification,
  deliverMarketplaceNotificationsBatch,
  type MarketplaceNotifyInput,
  type MarketplaceDeliveryResult,
  type BroadcastDeliveryDiagnostics,
} from "./deliver";

export {
  createSmartNotification,
  listSmartNotifications,
  countUnreadSmartNotifications,
  updateSmartNotificationStatus,
  markAllSmartNotificationsRead,
  categoryFromMarketplaceType,
} from "./center";

export {
  getNotificationPreferences,
  upsertNotificationPreferences,
  isCategoryEnabled,
  isInQuietHours,
} from "./preferences";

export {
  groupNotificationsForFeed,
  buildGroupKey,
  groupedTitle,
  type GroupedFeedItem,
} from "./grouping";

export {
  resolveBasePriority,
  suggestAiPriority,
  prioritySortWeight,
} from "./priority";

export {
  generateNotificationDigest,
  listNotificationDigests,
  markDigestOpened,
} from "./digest";

export { deliverSmartNotificationChannels } from "./channels";
