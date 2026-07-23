"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosisResult } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";

type Props = {
  problemId: ProblemId;
  result: DiagnosisResult;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onRestart: () => void;
};

export function DiagnosisSummaryStep({ result, pending, onBack, onConfirm, onRestart }: Props) {
  const t = useTranslations("search.diagnosis");
  const tAdvisor = useTranslations("search.advisor");

  const categoryLabel = t(
    `summary.categories.${result.categorySlug}` as "summary.categories.electrical",
  );
  const possibleCause = result.possibleCauseKey
    ? t(
        `problems.${result.problemId}.causes.${result.possibleCauseKey}` as "problems.power_outage.causes.bulb",
      )
    : null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-[var(--dalily-navy)]">{t("summary.title")}</h3>

      <dl className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t("summary.categoryLabel")}</dt>
          <dd className="font-semibold text-foreground">{categoryLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t("summary.urgencyLabel")}</dt>
          <dd className="font-semibold text-foreground">
            {tAdvisor(`urgency.${result.urgency}` as "urgency.normal")}
          </dd>
        </div>
        {possibleCause ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t("summary.possibleCauseLabel")}</dt>
            <dd className="font-semibold text-foreground">{possibleCause}</dd>
          </div>
        ) : null}
      </dl>

      <p className="text-xs text-muted-foreground">
        {t("summary.confidenceCaption", { percent: Math.round(result.confidence * 100) })}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="flex-1 gap-2 rounded-2xl"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {t("findProviders")}
        </Button>
        <Button type="button" variant="ghost" className="gap-1.5" onClick={onBack} disabled={pending}>
          <ArrowLeft className="size-3.5" aria-hidden />
          {t("back")}
        </Button>
        <Button type="button" variant="ghost" className="gap-1.5" onClick={onRestart} disabled={pending}>
          <RotateCcw className="size-3.5" aria-hidden />
          {t("startOver")}
        </Button>
      </div>
    </div>
  );
}
