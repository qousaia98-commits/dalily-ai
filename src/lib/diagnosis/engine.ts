import type { ProblemId } from "@/lib/search/engine/types";
import { categoryForProblem, priorityForProblem } from "@/lib/search/engine/problem-catalog";
import { DIAGNOSIS_CATALOG } from "@/lib/diagnosis/catalog";
import type { DiagnosisAnswers, DiagnosisDefinition, DiagnosisQuestion, DiagnosisResult } from "@/lib/diagnosis/types";

/** null for any ProblemId without a diagnosis flow — caller falls back to direct search. */
export function getDiagnosisDefinition(problemId: ProblemId | null): DiagnosisDefinition | null {
  if (!problemId) return null;
  return DIAGNOSIS_CATALOG[problemId] ?? null;
}

/**
 * Walks the question list in order, skipping already-answered questions and
 * any whose skipIf(answers) is true. Returns null once the list is exhausted
 * or the most recently given answer appears in that question's terminatesOn.
 */
export function getNextQuestion(
  definition: DiagnosisDefinition,
  answers: DiagnosisAnswers,
): DiagnosisQuestion | null {
  const answeredIds = Object.keys(answers);
  const lastQuestionId = answeredIds[answeredIds.length - 1];
  const lastQuestion = definition.questions.find((q) => q.id === lastQuestionId);
  if (lastQuestion?.terminatesOn?.includes(answers[lastQuestion.id])) {
    return null;
  }

  for (const question of definition.questions) {
    if (question.id in answers) continue;
    if (question.skipIf?.(answers)) continue;
    return question;
  }
  return null;
}

export function buildDiagnosisResult(
  definition: DiagnosisDefinition,
  answers: DiagnosisAnswers,
): DiagnosisResult {
  const basePriority = priorityForProblem(definition.problemId);
  const answerCount = Object.keys(answers).length;

  return {
    problemId: definition.problemId,
    categorySlug: categoryForProblem(definition.problemId),
    urgency: definition.resolveUrgency(answers, basePriority),
    possibleCauseKey: definition.resolvePossibleCause(answers),
    // Heuristic, not a calibrated ML probability — grows with confirmed answers.
    confidence: Math.min(0.95, 0.55 + answerCount * 0.1),
    answers,
  };
}
