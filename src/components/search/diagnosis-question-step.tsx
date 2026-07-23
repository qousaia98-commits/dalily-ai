"use client";

import { useTranslations } from "next-intl";
import { AssistantBubble } from "@/components/search/diagnosis-chat-bubble";
import type { DiagnosisQuestion } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";
import { cn } from "@/lib/utils";

type Props = {
  problemId: ProblemId;
  question: DiagnosisQuestion;
  disabled?: boolean;
  onAnswer: (optionId: string) => void;
};

export function DiagnosisQuestionStep({
  problemId,
  question,
  disabled = false,
  onAnswer,
}: Props) {
  const t = useTranslations("search.diagnosis");
  const base = `problems.${problemId}.questions.${question.id}` as const;

  return (
    <div className="animate-fade-in-up space-y-3">
      <AssistantBubble>
        {t(`${base}.label` as "problems.power_outage.questions.state.label")}
      </AssistantBubble>

      <div
        className="grid gap-2 ps-0 sm:ps-9"
        role="group"
        aria-label={t(`${base}.label` as "problems.power_outage.questions.state.label")}
      >
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(option.id)}
            className={cn(
              "min-h-12 w-full rounded-2xl border border-border/80 bg-card px-4 py-3.5",
              "text-start text-sm font-semibold leading-snug text-foreground sm:text-base",
              "shadow-sm transition duration-150",
              "hover:border-[var(--dalily-gold)]/50 hover:bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))]",
              "active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {t(
              `${base}.options.${option.id}` as "problems.power_outage.questions.state.options.off",
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
