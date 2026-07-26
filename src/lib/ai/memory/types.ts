import type { AiDialect, AiLanguage, AiResolveSource } from "@/lib/ai/types";

export type AiIntentMemoryRecord = {
  id: string;
  serviceRequestId: string | null;
  customerId: string | null;
  originalText: string;
  normalizedText: string;
  language: AiLanguage | null;
  dialect: AiDialect | null;
  detectedCategorySlug: string | null;
  detectedSubcategory: string | null;
  confidence: number | null;
  questionsAsked: unknown[];
  finalCategorySlug: string | null;
  finalCategoryId: string | null;
  source: AiResolveSource;
  wasCorrected: boolean;
  createdAt: string;
};

export type RecordIntentMemoryInput = {
  serviceRequestId?: string | null;
  customerId?: string | null;
  originalText: string;
  detectedCategorySlug?: string | null;
  detectedSubcategory?: string | null;
  confidence?: number | null;
  questionsAsked?: unknown[];
  finalCategorySlug?: string | null;
  finalCategoryId?: string | null;
  source?: AiResolveSource;
  wasCorrected?: boolean;
  metadata?: Record<string, unknown>;
};
