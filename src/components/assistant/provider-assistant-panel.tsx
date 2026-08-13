import { getLocale, getTranslations } from "next-intl/server";
import type { ProviderAssistantView } from "@/lib/ai/assistant/types";
import { AssistantSuggestionsClient } from "@/components/assistant/assistant-suggestions-client";

/**
 * Provider-facing personal AI assistant panel.
 */
export async function ProviderAssistantPanel({
  view,
}: {
  view: ProviderAssistantView;
}) {
  const t = await getTranslations("assistant.provider");
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <section
      className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3"
      aria-label={t("title")}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("badge")}
        </p>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>

      <p className="text-sm">
        {isAr ? view.workloadEstimateAr : view.workloadEstimateEn}
      </p>

      {view.todaySchedule.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("today")}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {view.todaySchedule.map((j) => (
              <li key={j.bookingId} className="flex justify-between gap-2">
                <span className="truncate">{j.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(j.startsAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("noToday")}</p>
      )}

      {view.suggestedNextJobs.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("suggestedJobs")}
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {view.suggestedNextJobs.map((j) => (
              <li key={j.assignmentId}>
                <span className="font-medium">{j.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {isAr ? j.reasonAr : j.reasonEn}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.preparationNotes.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("prep")}</p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {view.preparationNotes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.travelHints.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("travel")}</p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {view.travelHints.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(isAr ? view.customerSummaryAr : view.customerSummaryEn) ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("customerSummary")}
          </p>
          <p className="text-sm">
            {isAr ? view.customerSummaryAr : view.customerSummaryEn}
          </p>
        </div>
      ) : null}

      {view.conversationSummary ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("chatSummary")}
          </p>
          <p className="text-sm">
            {isAr
              ? view.conversationSummary.headlineAr
              : view.conversationSummary.headlineEn}
          </p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {(isAr
              ? view.conversationSummary.bulletsAr
              : view.conversationSummary.bulletsEn
            )
              .slice(0, 3)
              .map((b) => (
                <li key={b}>• {b}</li>
              ))}
          </ul>
        </div>
      ) : null}

      {view.missedOpportunities > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("missed", { count: view.missedOpportunities })}
        </p>
      ) : null}

      {view.suggestions.length > 0 ? (
        <AssistantSuggestionsClient suggestions={view.suggestions} />
      ) : null}
    </section>
  );
}
