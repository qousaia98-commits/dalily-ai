/** Sprint 5 Phase 3 — AI Communication Assistant types */

export type ChatSummaryWindow = "last_10" | "today" | "last_7_days" | "entire";
export type ChatSummaryStyle = "short" | "detailed" | "timeline" | "action";

export type ChatAiLanguage = "en" | "ar" | "de";

export type ChatExtractionField =
  | "appointment"
  | "address"
  | "phone"
  | "budget"
  | "requested_date"
  | "service_type"
  | "materials"
  | "urgency"
  | "other";

export type ChatActionKind =
  | "send_invoice"
  | "upload_photo"
  | "confirm_appointment"
  | "call_customer"
  | "order_materials"
  | "other";

export type ChatSentimentLabel =
  | "positive"
  | "neutral"
  | "frustrated"
  | "urgent"
  | "escalation_risk";

export type ChatLine = {
  id?: string;
  senderRole: "customer" | "provider" | "system" | "admin";
  bodyText: string;
  createdAt: string;
  isSystem?: boolean;
};

export type ChatSummaryResult = {
  window: ChatSummaryWindow;
  style: ChatSummaryStyle;
  title: string;
  body: string;
  bullets: string[];
  openItems: string[];
  nextSteps: string[];
  generatedBy: "rules" | "llm" | "hybrid";
  aiGenerated: true;
};

export type ChatReplySuggestion = {
  id: string;
  text: string;
  rationale?: string;
};

export type ChatExtraction = {
  id?: string;
  fieldKey: ChatExtractionField;
  fieldValue: string;
  confidence: number;
  messageId?: string | null;
};

export type ChatActionItem = {
  id: string;
  title: string;
  titleAr?: string | null;
  kind: ChatActionKind;
  status: "open" | "completed" | "dismissed";
  priority: "low" | "normal" | "high";
  assigneeRole?: "customer" | "provider" | "admin" | "either" | null;
};

export type ChatSentimentResult = {
  sentiment: ChatSentimentLabel;
  priority: "low" | "normal" | "high" | "critical";
  score: number;
  signals: string[];
};

export type ChatAiPreferences = {
  userId: string;
  aiEnabled: boolean;
  preferredLanguage: ChatAiLanguage | "auto" | null;
  autoTranslate: boolean;
  allowSummaries: boolean;
  allowSuggestions: boolean;
  allowExtraction: boolean;
  allowVoiceTranscription: boolean;
};

export type ChatTranslationResult = {
  sourceLang: string;
  targetLang: ChatAiLanguage;
  translatedText: string;
  detectedLang: string;
  aiGenerated: true;
};
