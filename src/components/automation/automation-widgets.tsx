import { getLocale, getTranslations } from "next-intl/server";
import type { AutomationSuggestion } from "@/lib/ai/automation/types";
import { AutomationFeedbackButtons } from "@/components/automation/automation-feedback-buttons";

export async function AutomationSuggestionsList({
  items,
}: {
  items: AutomationSuggestion[];
}) {
  const t = await getTranslations("automation.suggestions");
  const locale = await getLocale();
  const isAr = locale === "ar";
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </p>
      <ul className="space-y-3">
        {items.map((s) => (
          <li
            key={s.id ?? `${s.workflowId}-${s.titleEn}`}
            className="space-y-1.5 rounded-xl border border-border/50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {isAr ? s.titleAr : s.titleEn}
              </p>
              <span className="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">
                {Math.round(s.confidence * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr ? s.bodyAr : s.bodyEn}
            </p>
            <p className="text-[0.65rem] text-muted-foreground">
              {t("mode", { mode: s.decisionMode })} · {t("why")}:{" "}
              {isAr ? s.reasonAr : s.reasonEn}
            </p>
            {s.id &&
            (s.decisionMode === "confirm" ||
              s.status === "pending_confirmation" ||
              s.status === "recommended") ? (
              <AutomationFeedbackButtons actionId={s.id} />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
