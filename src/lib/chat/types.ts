/** Sprint 36 — Chat domain types (AI-ready, no UI logic). */

export type ChatMessageType =
  | "text"
  | "image"
  | "document"
  | "location"
  | "voice"
  | "system"
  | "video";

export type ChatDeliveryStatus = "sent" | "delivered" | "read";

export type ChatConversationStatus = "open" | "closed" | "archived";

export type ChatAttachmentKind = "image" | "document" | "voice" | "video" | "other";

export type ChatAttachment = {
  id: string;
  messageId: string;
  conversationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: ChatAttachmentKind;
  path: string;
  bucket: string;
  signedUrl?: string | null;
  width?: number | null;
  height?: number | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  bodyText: string;
  messageType: ChatMessageType;
  deliveryStatus: ChatDeliveryStatus;
  isSystem: boolean;
  eventType: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationLabel: string | null;
  clientId: string | null;
  metadata: Record<string, unknown>;
  attachments: ChatAttachment[];
};

export type ChatParticipant = {
  userId: string;
  role: "customer" | "provider" | "member" | "admin";
  lastReadAt: string | null;
  lastDeliveredAt: string | null;
  pinned: boolean;
  archived: boolean;
  displayName: string | null;
};

export type ChatConversation = {
  id: string;
  providerId: string;
  customerId: string;
  serviceRequestId: string | null;
  status: ChatConversationStatus;
  lastMessageAt: string | null;
  pinned: boolean;
  archived: boolean;
  unreadCount: number;
  peerName: string;
  peerUserId: string;
  previewText: string;
  peerPresence?: "online" | "offline" | null;
  peerLastSeenAt?: string | null;
};

/** Future AI plug-ins — interfaces only (Sprint 36 does not implement). */
export type ChatAiExtensionPoint =
  | "auto_translation"
  | "conversation_summary"
  | "suggested_replies"
  | "appointment_detection"
  | "price_extraction"
  | "address_extraction"
  | "sentiment_detection";

export type ChatAiHookContext = {
  conversationId: string;
  messageId?: string;
  locale?: "ar" | "en" | "de";
  metadata?: Record<string, unknown>;
};
