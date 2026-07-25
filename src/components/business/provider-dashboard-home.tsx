import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { KeyRound, Sparkles, MessageSquare, Briefcase, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhyMatchedReasons } from "@/components/business/why-matched-reasons";
import type { ProviderDashboardHome } from "@/domains/provider/dashboard";

/**
 * Unlock-first Provider Home (Sprint 8). Presentation only — data from getProviderDashboardHome.
 */
export async function ProviderDashboardHomeView({
  data,
  businessName,
}: {
  data: ProviderDashboardHome;
  businessName: string;
}) {
  const t = await getTranslations("providerDashboard");
  const paused =
    data.pauseState.vacation_mode || !data.pauseState.accepting_requests;

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden animate-fade-in">
      <header className="space-y-1">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title", { name: businessName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {paused ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <PauseCircle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <div>
            <p className="font-medium">{t("pause.title")}</p>
            <p className="text-muted-foreground">{t("pause.body")}</p>
            <Button asChild variant="link" className="h-auto px-0 pt-1">
              <Link href="/business/settings">{t("pause.cta")}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {/* P0 — Unlock SLA */}
      <section className="space-y-3" aria-labelledby="dash-unlock">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-[var(--dalily-gold)]" />
          <h2 id="dash-unlock" className="text-sm font-semibold uppercase tracking-wide">
            {t("unlock.title")}
          </h2>
        </div>
        {data.unlockPriority.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            {t("unlock.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.unlockPriority.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/business/unlock/${session.id}`}
                  className="block rounded-2xl border border-[var(--dalily-gold)]/50 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-4 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--dalily-gold)_14%,var(--card))]"
                >
                  <p className="font-medium">{t("unlock.leadPending")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("unlock.sla", {
                      deadline: new Date(session.slaDeadline).toLocaleString(),
                    })}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--dalily-gold)]">
                    {t(`unlock.status.${session.status}`)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/business/unlock">{t("unlock.viewAll")}</Link>
        </Button>
      </section>

      {/* Opportunities + why-matched */}
      <section className="space-y-3" aria-labelledby="dash-ops">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <h2 id="dash-ops" className="text-sm font-semibold uppercase tracking-wide">
            {t("opportunities.title")}
          </h2>
        </div>
        {data.opportunities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            {t("opportunities.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.opportunities.slice(0, 6).map((op) => (
              <li key={op.assignmentId}>
                <Link
                  href={`/business/opportunities/${op.assignmentId}`}
                  className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <p className="font-medium">{op.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {op.intentText}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {op.hasOffer ? t("opportunities.offered") : t("opportunities.open")}
                    {op.urgency === "emergency" ? ` · ${t("opportunities.emergency")}` : ""}
                  </p>
                  <WhyMatchedReasons reasons={op.reasons} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/business/opportunities">{t("opportunities.viewAll")}</Link>
        </Button>
      </section>

      {/* Q&A */}
      <section className="space-y-3" aria-labelledby="dash-qa">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4" />
          <h2 id="dash-qa" className="text-sm font-semibold uppercase tracking-wide">
            {t("qa.title")}
          </h2>
        </div>
        {data.pendingQa.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("qa.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {data.pendingQa.map((item) => (
              <li key={item.offerId}>
                <Link
                  href={
                    item.assignmentId
                      ? `/business/opportunities/${item.assignmentId}`
                      : "/business/opportunities"
                  }
                  className="block rounded-2xl border border-border px-4 py-3 text-sm hover:bg-muted/40"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{item.lastBody}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active jobs */}
      <section className="space-y-3" aria-labelledby="dash-jobs">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4" />
          <h2 id="dash-jobs" className="text-sm font-semibold uppercase tracking-wide">
            {t("jobs.title")}
          </h2>
        </div>
        {data.activeJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("jobs.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {data.activeJobs.map((job) => (
              <li key={job.serviceRequestId}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3 text-sm">
                  <p className="font-medium">{job.title}</p>
                  {job.conversationId ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/business/messages/${job.conversationId}`}>
                        {t("jobs.openChat")}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reliability (projections from unlock signals) */}
      {(data.reliability.declinedCount > 0 || data.reliability.timedOutCount > 0) && (
        <section className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("reliability.title")}</p>
          <p className="mt-1">
            {t("reliability.body", {
              declined: data.reliability.declinedCount,
              timedOut: data.reliability.timedOutCount,
            })}
          </p>
        </section>
      )}
    </div>
  );
}
