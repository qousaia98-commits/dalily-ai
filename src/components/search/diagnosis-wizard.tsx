"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { getDiagnosisDefinition, getNextQuestion, buildDiagnosisResult } from "@/lib/diagnosis/engine";
import { logDiagnosisEventAction } from "@/actions/diagnosis.actions";
import type { DiagnosisAnswers, DiagnosisResult } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";
import { cn } from "@/lib/utils";
import { DiagnosisQuestionStep } from "@/components/search/diagnosis-question-step";
import { DiagnosisSummaryStep } from "@/components/search/diagnosis-summary-step";

type Props = {
  problemId: ProblemId;
  onExit: () => void;
  onComplete: (result: DiagnosisResult) => void;
};

export function DiagnosisWizard({ problemId, onExit, onComplete }: Props) {
  const t = useTranslations("search.diagnosis");
  const def = useMemo(() => getDiagnosisDefinition(problemId), [problemId]);
  const [answers, setAnswers] = useState<DiagnosisAnswers>({});
  const [phase, setPhase] = useState<"question" | "summary">("question");
  const [pending, startTransition] = useTransition();

  if (!def) {
    // Defensive guard — should never happen given detectDiagnosisAction's contract.
    onExit();
    return null;
  }

  const currentQuestion = phase === "question" ? getNextQuestion(def, answers) : null;
  const askedCount = Object.keys(answers).length + (currentQuestion ? 1 : 0);
  const diagnosisResult = phase === "summary" ? buildDiagnosisResult(def, answers) : null;

  function handleAnswer(optionId: string) {
    if (!currentQuestion || !def) return;
    const nextAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(nextAnswers);
    if (!getNextQuestion(def, nextAnswers)) {
      setPhase("summary");
    }
  }

  function handleBack() {
    if (phase === "summary") {
      setPhase("question");
      return;
    }
    const answeredIds = Object.keys(answers);
    const lastId = answeredIds[answeredIds.length - 1];
    if (!lastId) {
      onExit();
      return;
    }
    const rest = { ...answers };
    delete rest[lastId];
    setAnswers(rest);
  }

  function handleSkip() {
    void logDiagnosisEventAction({
      eventType: "diagnosis_abandoned",
      problemId,
      metadata: { answers, atQuestion: currentQuestion?.id ?? null },
    });
    onExit();
  }

  function handleConfirm(result: DiagnosisResult) {
    startTransition(async () => {
      await logDiagnosisEventAction({
        eventType: "diagnosis_completed",
        problemId,
        metadata: {
          answers: result.answers,
          urgency: result.urgency,
          possibleCauseKey: result.possibleCauseKey,
        },
      });
      onComplete(result);
    });
  }

  const totalQuestions = def.questions.length;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-lg shadow-primary/5 sm:p-5">
      {phase === "question" && currentQuestion ? (
        <div className="mb-4 space-y-2">
          <div className="flex gap-1.5">
            {def.questions.map((question, index) => (
              <div
                key={question.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  index < askedCount ? "bg-[var(--dalily-gold)]" : "bg-border",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("stepOf", { current: askedCount, total: totalQuestions })}
          </p>
        </div>
      ) : null}

      {phase === "question" && currentQuestion ? (
        <DiagnosisQuestionStep
          problemId={problemId}
          question={currentQuestion}
          onAnswer={handleAnswer}
          onBack={handleBack}
        />
      ) : null}

      {phase === "summary" && diagnosisResult ? (
        <DiagnosisSummaryStep
          problemId={problemId}
          result={diagnosisResult}
          pending={pending}
          onBack={handleBack}
          onConfirm={() => handleConfirm(diagnosisResult)}
          onRestart={() => {
            setAnswers({});
            setPhase("question");
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={handleSkip}
        className="mt-4 w-full text-center text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        {t("skip")}
      </button>
    </div>
  );
}
