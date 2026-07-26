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

export type ChatScope =
  | "request"
  | "project"
  | "package"
  | "emergency"
  | "admin"
  | "support";

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
  replyToMessageId: string | null;
  replyPreview?: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
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
  chatScope?: ChatScope;
  projectId?: string | null;
  packageId?: string | null;
  adminUserId?: string | null;
};

/** Future AI plug-ins — Sprint 5 Phase 3 implements these via src/lib/ai/chat. */
export type ChatAiExtensionPoint =
  | "auto_translation"
  | "conversation_summary"
  | "suggested_replies"
  | "appointment_detection"
  | "price_extraction"
  | "address_extraction"
  | "sentiment_detection"
  | "action_items"
  | "information_extraction";

export type ChatAiHookContext = {
  conversationId: string;
  messageId?: string;
  locale?: "ar" | "en" | "de";
  metadata?: Record<string, unknown>;
};
