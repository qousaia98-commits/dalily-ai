"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getDiagnosisDefinition, getNextQuestion, buildDiagnosisResult } from "@/lib/diagnosis/engine";
import { logDiagnosisEventAction } from "@/actions/diagnosis.actions";
import type { DiagnosisAnswers, DiagnosisResult } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";
import { cn } from "@/lib/utils";
import { DiagnosisQuestionStep } from "@/components/search/diagnosis-question-step";
import { DiagnosisSummaryStep } from "@/components/search/diagnosis-summary-step";
import { DiagnosisHistoryEntry } from "@/components/search/diagnosis-history-entry";
import { DiagnosisTypingIndicator } from "@/components/search/diagnosis-typing-indicator";

const TYPING_DELAY_MS = 450;
/** Grace period to read the summary before the provider search kicks off on its own. */
const AUTO_CONFIRM_DELAY_MS = 1600;

type Props = {
  problemId: ProblemId;
  /** Leave wizard and return to the search input (Back with no history). */
  onExit: () => void;
  /** Skip diagnosis and search immediately with the original query. */
  onSkip: () => void;
  onComplete: (result: DiagnosisResult) => void;
};

function countAskableQuestions(
  def: NonNullable<ReturnType<typeof getDiagnosisDefinition>>,
  answers: DiagnosisAnswers,
): number {
  return def.questions.filter((question) => {
    if (question.id in answers) return true;
    if (question.skipIf?.(answers)) return false;
    return true;
  }).length;
}

export function DiagnosisWizard({ problemId, onExit, onSkip, onComplete }: Props) {
  const t = useTranslations("search.diagnosis");
  const def = useMemo(() => getDiagnosisDefinition(problemId), [problemId]);
  const [answers, setAnswers] = useState<DiagnosisAnswers>({});
  const [phase, setPhase] = useState<"question" | "summary">("question");
  const [typing, setTyping] = useState(true);
  const [pending, startTransition] = useTransition();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (def) return;
    onExit();
    // Intentionally omit onExit — parent may pass an unstable inline callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  useEffect(() => {
    typingTimeoutRef.current = setTimeout(() => setTyping(false), TYPING_DELAY_MS);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const answeredEntries = Object.entries(answers);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [answeredEntries.length, phase, typing]);

  const diagnosisResult = useMemo(
    () => (def && phase === "summary" ? buildDiagnosisResult(def, answers) : null),
    [def, phase, answers],
  );

  // Once the summary has finished "typing" in, the search starts on its own —
  // the buttons below are an early-out, not a required step.
  useEffect(() => {
    if (!diagnosisResult || typing) return;
    autoConfirmTimeoutRef.current = setTimeout(() => {
      handleConfirm(diagnosisResult);
    }, AUTO_CONFIRM_DELAY_MS);
    return () => {
      if (autoConfirmTimeoutRef.current) clearTimeout(autoConfirmTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosisResult, typing]);

  if (!def) return null;

  const currentQuestion = phase === "question" ? getNextQuestion(def, answers) : null;
  const askableTotal = countAskableQuestions(def, answers);
  const answeredAskable = answeredEntries.filter(([id]) => {
    const question = def.questions.find((q) => q.id === id);
    return Boolean(question);
  }).length;
  const currentStep = Math.min(
    answeredAskable + (currentQuestion ? 1 : 0),
    Math.max(askableTotal, 1),
  );

  function triggerTyping(delay = TYPING_DELAY_MS) {
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), delay);
  }

  function handleAnswer(optionId: string) {
    if (!currentQuestion || !def || typing) return;
    const nextAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(nextAnswers);
    if (!getNextQuestion(def, nextAnswers)) {
      setPhase("summary");
    }
    triggerTyping();
  }

  function handleBack() {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping(false);
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
    onSkip();
  }

  function handleFinish() {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setPhase("summary");
    triggerTyping();
  }

  function handleRestart() {
    if (autoConfirmTimeoutRef.current) clearTimeout(autoConfirmTimeoutRef.current);
    confirmedRef.current = false;
    setAnswers({});
    setPhase("question");
    triggerTyping();
  }

  function handleConfirm(result: DiagnosisResult) {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    if (autoConfirmTimeoutRef.current) clearTimeout(autoConfirmTimeoutRef.current);
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

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg shadow-primary/5">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3 sm:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_16%,var(--card))] text-[var(--dalily-gold)]">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--dalily-navy)]">
            {t("assistantName")}
          </p>
          {phase === "question" && currentQuestion ? (
            <p className="text-xs text-muted-foreground">
              {t("stepOf", { current: currentStep, total: askableTotal })}
            </p>
          ) : null}
        </div>
      </div>

      {phase === "question" && currentQuestion ? (
        <div
          className="flex gap-1.5 px-4 pt-3 sm:px-5"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={askableTotal}
          aria-label={t("stepOf", { current: currentStep, total: askableTotal })}
        >
          {Array.from({ length: askableTotal }, (_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index < currentStep ? "bg-[var(--dalily-gold)]" : "bg-border",
              )}
            />
          ))}
        </div>
      ) : null}

      <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5">
        {answeredEntries.map(([questionId, optionId]) => {
          const question = def.questions.find((q) => q.id === questionId);
          if (!question) return null;
          return (
            <DiagnosisHistoryEntry
              key={questionId}
              problemId={problemId}
              question={question}
              optionId={optionId}
            />
          );
        })}

        {phase === "question" ? (
          typing ? (
            <DiagnosisTypingIndicator />
          ) : currentQuestion ? (
            <DiagnosisQuestionStep
              problemId={problemId}
              question={currentQuestion}
              disabled={pending}
              onAnswer={handleAnswer}
            />
          ) : null
        ) : null}

        {phase === "summary" ? (
          typing ? (
            <DiagnosisTypingIndicator />
          ) : diagnosisResult ? (
            <DiagnosisSummaryStep
              result={diagnosisResult}
              pending={pending}
              onConfirm={() => handleConfirm(diagnosisResult)}
              onRestart={handleRestart}
            />
          ) : null
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={handleBack}
          className="flex min-h-10 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t("back")}
        </button>
        <div className="flex items-center gap-3">
          {phase === "question" && currentQuestion ? (
            <button
              type="button"
              onClick={handleFinish}
              className="min-h-10 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("finish")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-10 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
