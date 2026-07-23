"use client";

import { useTranslations } from "next-intl";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantBubble } from "@/components/search/diagnosis-chat-bubble";
import type { DiagnosisResult } from "@/lib/diagnosis/types";

type Props = {
  result: DiagnosisResult;
  pending: boolean;
  onConfirm: () => void;
  onRestart: () => void;
};

export function DiagnosisSummaryStep({ result, pending, onConfirm, onRestart }: Props) {
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
    <div className="animate-fade-in-up space-y-2.5">
      <AssistantBubble>
        <div className="space-y-2">
          <p className="font-semibold text-[var(--dalily-navy)]">{t("summary.title")}</p>
          <dl className="space-y-1.5">
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
        </div>
      </AssistantBubble>

      <div className="flex flex-wrap gap-2 ps-9">
        <Button
          type="button"
          className="gap-2 rounded-full"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {t("findProviders")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 rounded-full"
          onClick={onRestart}
          disabled={pending}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t("startOver")}
        </Button>
      </div>

      {pending ? (
        <p className="ps-9 text-xs text-muted-foreground">{t("summary.autoRedirectCaption")}</p>
      ) : null}
    </div>
  );
}
