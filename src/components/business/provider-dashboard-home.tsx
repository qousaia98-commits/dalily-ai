import { getTranslations } from "next-intl/server";
import {
  KeyRound,
  Sparkles,
  MessageSquare,
  Briefcase,
  PauseCircle,
  Inbox,
  Wallet,
  User,
  Clock3,
  Star,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { WhyMatchedReasons } from "@/components/business/why-matched-reasons";
import { NavCountBadge } from "@/components/shared/nav-count-badge";
import type { ProviderDashboardHome } from "@/domains/provider/dashboard";
import type { PersonalizedGreeting } from "@/lib/greetings";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/**
 * Clean provider business home — greeting, today overview, quick actions, activity.
 * Presentation only; data from getProviderDashboardHome (Marketplace v2 unchanged).
 */
export async function ProviderDashboardHomeView({
  data,
  greeting,
}: {
  data: ProviderDashboardHome;
  greeting: PersonalizedGreeting;
}) {
  const t = await getTranslations("providerDashboard");
  const locale = (await getLocale()) as Locale;
  const rtl = locale === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const paused =
    data.pauseState.vacation_mode || !data.pauseState.accepting_requests;
  const { today, jobSections } = data;

  const summaryCards = [
    {
      key: "opportunities",
      href: "/business/opportunities",
      icon: Sparkles,
      label: t("today.opportunities"),
      value: today.opportunitiesOpen,
      accent: true,
    },
    {
      key: "unlock",
      href: "/business/payments",
      icon: KeyRound,
      label: t("today.unlock"),
      value: today.unlockPending,
      accent: today.unlockPending > 0,
    },
    {
      key: "waiting",
      href: "/business/opportunities",
      icon: Inbox,
      label: t("today.waiting"),
      value: today.waitingConfirmation,
    },
    {
      key: "jobs",
      href: "/business/orders",
      icon: Briefcase,
      label: t("today.activeJobs"),
      value: today.activeJobs,
    },
    {
      key: "messages",
      href: "/business/messages",
      icon: MessageSquare,
      label: t("today.messages"),
      value: today.unreadMessages,
    },
    {
      key: "rating",
      href: "/business/account",
      icon: Star,
      label: t("today.rating"),
      value:
        today.ratingAvg != null ? today.ratingAvg.toFixed(1) : t("today.ratingEmpty"),
      isText: true,
    },
  ] as const;

  const quickActions = [
    {
      href: "/business/opportunities",
      icon: Sparkles,
      label: t("quickActions.opportunities"),
      badge: jobSections.newOpportunities,
    },
    {
      href: "/business/orders",
      icon: Briefcase,
      label: t("quickActions.jobs"),
      badge: jobSections.activeJobs,
    },
    {
      href: "/business/messages",
      icon: MessageSquare,
      label: t("quickActions.messages"),
      badge: today.unreadMessages,
    },
      {
      href: "/business/payments",
      icon: Wallet,
      label: t("quickActions.payments"),
      badge: jobSections.unlockPending,
    },
    {
      href: "/business/account",
      icon: User,
      label: t("quickActions.profile"),
    },
    {
      href: "/business/availability",
      icon: Clock3,
      label: t("quickActions.availability"),
    },
  ] as const;

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {greeting.title}
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          {greeting.subtitle}
        </p>
      </header>

      {paused ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          role="status"
        >
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

      {/* Today overview */}
      <section className="space-y-3" aria-labelledby="today-overview">
        <div className="flex items-end justify-between gap-3">
          <h2 id="today-overview" className="text-base font-semibold tracking-tight">
            {t("today.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("today.hint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                className={cn(
                  "group flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-all duration-200",
                  "hover:border-[var(--dalily-gold)]/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/50",
                  "accent" in card && card.accent
                    ? "border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_7%,var(--card))]"
                    : null,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="size-4 text-[var(--dalily-gold)] opacity-90" aria-hidden />
                  {"isText" in card && card.isText ? null : (
                    <NavCountBadge count={typeof card.value === "number" ? card.value : 0} />
                  )}
                </div>
                <p
                  className={cn(
                    "text-xl font-bold tabular-nums tracking-tight",
                    "isText" in card && card.isText ? "text-lg" : null,
                  )}
                >
                  {card.value}
                </p>
                <p className="text-[0.7rem] font-medium leading-snug text-muted-foreground">
                  {card.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-3" aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="text-base font-semibold tracking-tight">
          {t("quickActions.title")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const badge = "badge" in action ? action.badge ?? 0 : 0;
            return (
              <Link
                key={action.href + action.label}
                href={action.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl border border-border bg-background px-3 py-3 text-sm font-medium",
                  "transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/50",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/70">
                  <Icon className="size-4 text-foreground/80" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                <NavCountBadge count={badge} />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Job sections with counts */}
      <section className="space-y-3" aria-labelledby="job-sections">
        <h2 id="job-sections" className="text-base font-semibold tracking-tight">
          {t("sections.title")}
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {(
            [
              {
                href: "/business/opportunities",
                label: t("sections.newOpportunities"),
                count: jobSections.newOpportunities,
              },
              {
                href: "/business/opportunities",
                label: t("sections.waitingConfirmation"),
                count: jobSections.waitingConfirmation,
              },
              {
                href: "/business/payments",
                label: t("sections.unlockPending"),
                count: jobSections.unlockPending,
              },
              {
                href: "/business/orders",
                label: t("sections.activeJobs"),
                count: jobSections.activeJobs,
              },
              {
                href: "/business/opportunities",
                label: t("sections.pendingQa"),
                count: jobSections.pendingQa,
              },
              {
                href: "/business/orders",
                label: t("sections.allJobs"),
                count: null as number | null,
              },
            ] as const
          ).map((row) => (
            <li key={row.label}>
              <Link
                href={row.href}
                className="flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50"
              >
                <span className="flex-1 font-medium">{row.label}</span>
                {row.count != null ? (
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                ) : null}
                <Arrow className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Priority activity — unlock first */}
      {data.unlockPriority.length > 0 ? (
        <section className="space-y-3" aria-labelledby="dash-unlock">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-[var(--dalily-gold)]" aria-hidden />
              <h2 id="dash-unlock" className="text-sm font-semibold">
                {t("unlock.title")}
              </h2>
              <NavCountBadge count={data.unlockPriority.length} />
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8">
              <Link href="/business/unlock">{t("unlock.viewAll")}</Link>
            </Button>
          </div>
          <ul className="space-y-2">
            {data.unlockPriority.slice(0, 3).map((session) => (
              <li key={session.id}>
                <Link
                  href={`/business/unlock/${session.id}`}
                  className="block rounded-2xl border border-[var(--dalily-gold)]/50 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-4 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--dalily-gold)_14%,var(--card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/50"
                >
                  <p className="font-medium">{t("unlock.leadPending")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("unlock.sla", {
                      deadline: new Date(session.slaDeadline).toLocaleString(locale),
                    })}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[var(--dalily-gold)]">
                    {t(`unlock.status.${session.status}`)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Opportunities preview */}
      <section className="space-y-3" aria-labelledby="dash-ops">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            <h2 id="dash-ops" className="text-sm font-semibold">
              {t("opportunities.title")}
            </h2>
            <NavCountBadge count={today.opportunitiesOpen} />
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/business/opportunities">{t("opportunities.viewAll")}</Link>
          </Button>
        </div>
        {data.opportunities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("opportunities.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.opportunities.slice(0, 4).map((op) => (
              <li key={op.assignmentId}>
                <Link
                  href={`/business/opportunities/${op.assignmentId}`}
                  className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/50"
                >
                  <p className="font-medium">{op.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {op.intentText}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {op.hasOffer ? t("opportunities.offered") : t("opportunities.open")}
                    {op.urgency === "emergency" ? ` · ${t("opportunities.emergency")}` : ""}
                  </p>
                  <WhyMatchedReasons
                    reasons={op.reasons}
                    aiMatchScore={op.aiMatchScore}
                    aiExplanation={op.aiExplanation}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Q&A + active jobs — only when relevant */}
      {data.pendingQa.length > 0 ? (
        <section className="space-y-3" aria-labelledby="dash-qa">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4" aria-hidden />
            <h2 id="dash-qa" className="text-sm font-semibold">
              {t("qa.title")}
            </h2>
            <NavCountBadge count={data.pendingQa.length} />
          </div>
          <ul className="space-y-2">
            {data.pendingQa.slice(0, 4).map((item) => (
              <li key={item.offerId}>
                <Link
                  href={
                    item.assignmentId
                      ? `/business/opportunities/${item.assignmentId}`
                      : "/business/opportunities"
                  }
                  className="block rounded-2xl border border-border px-4 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/50"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{item.lastBody}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.activeJobs.length > 0 ? (
        <section className="space-y-3" aria-labelledby="dash-jobs">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4" aria-hidden />
            <h2 id="dash-jobs" className="text-sm font-semibold">
              {t("jobs.title")}
            </h2>
            <NavCountBadge count={data.activeJobs.length} />
          </div>
          <ul className="space-y-2">
            {data.activeJobs.slice(0, 5).map((job) => (
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
        </section>
      ) : null}

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
