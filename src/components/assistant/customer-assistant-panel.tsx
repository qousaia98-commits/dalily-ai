import { getLocale, getTranslations } from "next-intl/server";
import type { CustomerAssistantView } from "@/lib/ai/assistant/types";
import { AssistantSuggestionsClient } from "@/components/assistant/assistant-suggestions-client";
import { PublicVerificationBadge } from "@/components/verification/public-verification-badge";

/**
 * Customer-facing personal AI assistant panel.
 */
export async function CustomerAssistantPanel({
  view,
  serviceRequestId,
}: {
  view: CustomerAssistantView;
  serviceRequestId: string;
}) {
  const t = await getTranslations("assistant.customer");
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
        {isAr ? view.stepExplanationAr : view.stepExplanationEn}
      </p>
      <p className="text-sm font-medium">
        {t("nextAction")}: {isAr ? view.nextActionAr : view.nextActionEn}
      </p>

      {view.missingInfo.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("missing")}: {view.missingInfo.join(" · ")}
        </p>
      ) : null}

      {view.offerComparison && view.offerComparison.items.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("offerCompare")}
          </p>
          <p className="text-sm">
            {isAr
              ? view.offerComparison.explanationAr
              : view.offerComparison.explanationEn}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {(isAr
              ? view.offerComparison.reasonsAr
              : view.offerComparison.reasonsEn
            ).map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
          <ol className="mt-2 space-y-1 text-sm">
            {view.offerComparison.items.slice(0, 3).map((item, i) => (
              <li key={item.offerId} className="flex justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span>
                    {i + 1}. {item.providerName}
                  </span>
                  {item.verified ? (
                    <PublicVerificationBadge
                      providerId={item.providerId}
                      verified
                    />
                  ) : null}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {item.price} {item.currency}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {view.appointment ? (
        <div className="space-y-1 rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {t("appointment")}
          </p>
          <p>{isAr ? view.appointment.reminderAr : view.appointment.reminderEn}</p>
          <p className="text-xs text-muted-foreground">
            {view.appointment.problemSummary}
          </p>
          {view.appointment.preparation.length > 0 ? (
            <ul className="text-xs text-muted-foreground">
              {view.appointment.preparation.slice(0, 4).map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {view.afterJob ? (
        <div className="space-y-1 rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {t("afterJob")}
          </p>
          <p>{isAr ? view.afterJob.jobSummaryAr : view.afterJob.jobSummaryEn}</p>
          {view.afterJob.askReview ? (
            <p className="text-xs font-medium">{t("askReview")}</p>
          ) : null}
          {view.afterJob.followUpWork.length > 0 ? (
            <ul className="text-xs text-muted-foreground">
              {view.afterJob.followUpWork.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {view.suggestions.length > 0 ? (
        <AssistantSuggestionsClient
          serviceRequestId={serviceRequestId}
          suggestions={view.suggestions}
        />
      ) : null}
    </section>
  );
}
