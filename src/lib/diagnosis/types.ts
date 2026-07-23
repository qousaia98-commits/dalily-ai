import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";
import type { CategorySlug } from "@/lib/categories/types";

export type DiagnosisOption = {
  id: string;
  /** Suffix resolved via useTranslations("search.diagnosis") — never literal text. */
  labelKey: string;
};

export type DiagnosisAnswers = Record<string, string>;

export type DiagnosisQuestion = {
  id: string;
  labelKey: string;
  options: DiagnosisOption[];
  /** Skip this question when true given the answers collected so far. */
  skipIf?: (answers: DiagnosisAnswers) => boolean;
  /** Answering with one of these option ids ends the wizard early. */
  terminatesOn?: string[];
};

export type DiagnosisDefinition = {
  problemId: ProblemId;
  questions: DiagnosisQuestion[];
  /** Deterministic — never an AI call. May escalate or de-escalate the catalog default. */
  resolveUrgency: (answers: DiagnosisAnswers, basePriority: ProblemPriority) => ProblemPriority;
  /** Returns an i18n key suffix (under search.diagnosis.problems.<id>.causes), or null. */
  resolvePossibleCause: (answers: DiagnosisAnswers) => string | null;
};

export type DiagnosisResult = {
  problemId: ProblemId;
  categorySlug: CategorySlug;
  urgency: ProblemPriority;
  possibleCauseKey: string | null;
  /** Heuristic (grows with the number of confirmed answers) — not a calibrated ML probability. */
  confidence: number;
  answers: DiagnosisAnswers;
};
