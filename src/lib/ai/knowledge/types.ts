import type { AiDialect, AiLanguage } from "@/lib/ai/types";

export type KnowledgePhrase = {
  id: string;
  phrase: string;
  normalizedPhrase: string;
  categorySlug: string;
  subcategory: string | null;
  language: AiLanguage | string;
  dialect: AiDialect | string | null;
  confidence: number;
  occurrences: number;
  confirmations: number;
  corrections: number;
  successRate: number;
  lastUsedAt: string;
};

export type KnowledgeLookupHit = {
  phrase: KnowledgePhrase;
  /** Effective score used for threshold (confidence * successRate blend). */
  score: number;
};

export type KnowledgeFeedbackKind = "confirm" | "correct";
