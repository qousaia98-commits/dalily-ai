/** AI Engine Phase 6 — Voice Intelligence types. */

import type { AiDecision } from "@/lib/ai/decision/types";

export type VoiceLanguageCode =
  | "ar"
  | "en"
  | "de"
  | "mixed"
  | "und";

export type VoiceDialectCode =
  | "syrian"
  | "lebanese"
  | "levantine"
  | "msa"
  | "en_us"
  | "en_gb"
  | "de"
  | "mixed"
  | "unknown";

export type VoiceLanguageDetection = {
  language: VoiceLanguageCode;
  dialect: VoiceDialectCode;
  confidence: number;
  whisperLanguage: string | null;
};

export type SmartTranscript = {
  original: string;
  normalized: string;
  fillersRemoved: string[];
};

export type VoiceInterpretation = {
  categorySlug: string | null;
  urgency: "emergency" | "high" | "normal" | "low";
  summaryEn: string;
  summaryAr: string;
  confidence: number;
  decision: AiDecision | null;
};

export type MultimodalFusionResult = {
  primaryText: string;
  sourcePriority: Array<"voice" | "text" | "image">;
  categorySlug: string | null;
  urgency: "emergency" | "high" | "normal" | "low";
  contradiction: boolean;
  needsClarification: boolean;
  clarificationPromptKey: string | null;
  fusedConfidence: number;
  summaryEn: string;
  summaryAr: string;
};

export type VoicePipelineResult = {
  transcriptId: string | null;
  smart: SmartTranscript;
  language: VoiceLanguageDetection;
  interpretation: VoiceInterpretation;
  fusion: MultimodalFusionResult;
  fromCache: boolean;
};

export type VoiceProviderPreview = {
  transcriptId: string;
  originalTranscript: string;
  normalizedTranscript: string;
  editedTranscript: string | null;
  language: string | null;
  dialect: string | null;
  categorySlug: string | null;
  urgency: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  audioUrl: string | null;
  confidence: number | null;
};
