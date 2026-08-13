/** Sprint 5 Phase 4 — chat voice types */

export type ChatVoiceTranscriptStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

export type ChatVoiceTranscript = {
  id: string;
  conversationId: string;
  messageId: string;
  attachmentId?: string | null;
  language: string | null;
  transcriptText: string;
  summaryText: string | null;
  summaryBullets: string[];
  extracted: Array<{ fieldKey: string; fieldValue: string; confidence?: number }>;
  status: ChatVoiceTranscriptStatus;
  durationMs: number | null;
  createdAt: string;
};

export type ChatVoiceSearchHit = {
  id: string;
  conversationId: string;
  messageId: string;
  transcriptText: string;
  summaryText: string | null;
  language: string | null;
  createdAt: string;
};
