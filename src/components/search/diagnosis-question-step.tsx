"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosisQuestion } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";

type Props = {
  problemId: ProblemId;
  question: DiagnosisQuestion;
  onAnswer: (optionId: string) => void;
  onBack: () => void;
};

export function DiagnosisQuestionStep({ problemId, question, onAnswer, onBack }: Props) {
  const t = useTranslations("search.diagnosis");
  const base = `problems.${problemId}.questions.${question.id}` as const;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-[var(--dalily-navy)]">
        {t(`${base}.label` as "problems.power_outage.questions.state.label")}
      </h3>
      <div className="grid gap-2">
        {question.options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            className="h-auto justify-start rounded-2xl px-4 py-3 text-start text-sm font-medium whitespace-normal"
            onClick={() => onAnswer(option.id)}
          >
            {t(
              `${base}.options.${option.id}` as "problems.power_outage.questions.state.options.off",
            )}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("back")}
      </Button>
    </div>
  );
}
