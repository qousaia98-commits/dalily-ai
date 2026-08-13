import type { AiResolveSource } from "@/lib/ai/types";

export type IntentResolveResult = {
  categorySlug: string;
  subcategory: string | null;
  confidence: number;
  source: AiResolveSource;
  problemId: string | null;
  /** True when knowledge base satisfied the request without LLM. */
  skippedLlm: boolean;
  language: string;
  hypothesizedUrgency: "emergency" | "normal";
};
