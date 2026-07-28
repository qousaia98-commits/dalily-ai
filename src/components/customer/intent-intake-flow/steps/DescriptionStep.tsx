"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type DescriptionStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  completenessScore: number | null;
  clarifyNotes: string[];
  aiQuestions: Array<{ id: string; promptKey: string }>;
  clarifyAnswers: Record<number, string>;
  onClarifyAnswerChange: (index: number, value: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
};

/** Clarify-step UI (named DescriptionStep per sprint layout). */
export function DescriptionStep({
  t,
  completenessScore,
  clarifyNotes,
  aiQuestions,
  clarifyAnswers,
  onClarifyAnswerChange,
  onBack,
  onSkip,
  onContinue,
}: DescriptionStepProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("steps.clarify.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.clarify.subtitle")}</p>
      </div>
      {completenessScore != null ? (
        <p className="text-xs text-muted-foreground">
          {t("steps.clarify.completeness", { score: completenessScore })}
        </p>
      ) : null}
      {clarifyNotes.map((key, index) => (
        <div key={`${aiQuestions[index]?.id ?? key}-${index}`} className="space-y-2">
          <Label htmlFor={`clarify-${index}`}>
            {t(key as "clarify.electrical.scope")}
          </Label>
          <Textarea
            id={`clarify-${index}`}
            rows={2}
            className="rounded-2xl"
            value={clarifyAnswers[index] ?? ""}
            onChange={(e) => onClarifyAnswerChange(index, e.target.value)}
            placeholder={t("steps.clarify.placeholder")}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={onSkip}>
          {t("steps.clarify.skip")}
        </Button>
        <Button type="button" className="flex-1 rounded-xl" onClick={onContinue}>
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
