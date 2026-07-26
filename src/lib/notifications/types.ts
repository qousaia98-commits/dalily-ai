/** Sprint 5 Phase 6 — Smart Notification Center types */

export type NotifPriority = "critical" | "high" | "normal" | "low";

export type NotifCategory =
  | "marketplace"
  | "bookings"
  | "emergency"
  | "projects"
  | "messages"
  | "voice"
  | "tasks"
  | "approvals"
  | "recurring"
  | "invoices"
  | "payments"
  | "admin"
  | "system";

export type NotifStatus = "unread" | "read" | "archived" | "deleted";

export type NotifChannel = "in_app" | "push" | "email";

export type NotifDigestKind = "morning" | "daily" | "weekly" | "unread";

export type NotifActionKey =
  | "open"
  | "reply_message"
  | "accept_booking"
  | "approve_quotation"
  | "open_project"
  | "pay_invoice"
  | "open_emergency"
  | "dismiss";

export type SmartNotification = {
  id: string;
  userId: string;
  category: NotifCategory;
  eventKey: string;
  priority: NotifPriority;
  aiSuggestedPriority: NotifPriority | null;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  href: string | null;
  actionKey: NotifActionKey | null;
  actionLabelEn: string | null;
  actionLabelAr: string | null;
  actionPayload: Record<string, unknown>;
  groupKey: string | null;
  groupId: string | null;
  isGroupSummary: boolean;
  groupCount: number;
  status: NotifStatus;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type NotificationPreferences = {
  userId: string;
  channelInApp: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  catChat: boolean;
  catBookings: boolean;
  catEmergency: boolean;
  catProjects: boolean;
  catMarketplace: boolean;
  catPayments: boolean;
  catVoice: boolean;
  catTasks: boolean;
  catApprovals: boolean;
  catRecurring: boolean;
  catInvoices: boolean;
  catAdmin: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  digestMorning: boolean;
  digestDaily: boolean;
  digestWeekly: boolean;
};

export type NotificationDigest = {
  id: string;
  userId: string;
  digestKind: NotifDigestKind;
  summaryEn: string;
  summaryAr: string;
  highlights: string[];
  notificationIds: string[];
  readAt: string | null;
  createdAt: string;
};

export type CreateSmartNotificationInput = {
  userId: string;
  category: NotifCategory;
  eventKey: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  href?: string | null;
  priority?: NotifPriority;
  actionKey?: NotifActionKey | null;
  actionLabelEn?: string | null;
  actionLabelAr?: string | null;
  actionPayload?: Record<string, unknown>;
  groupKey?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  marketplaceNotificationId?: string | null;
  metadata?: Record<string, unknown>;
  /** Skip email/push even if prefs allow (e.g. quiet critical still in-app). */
  forceInAppOnly?: boolean;
};
