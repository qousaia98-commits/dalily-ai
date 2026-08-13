"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { PublicVerificationBadge } from "@/components/verification/public-verification-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  selectOfferAction,
  declineOfferAction,
  postOfferClarificationAction,
  toggleHiringShortlistAction,
  type OfferActionState,
} from "@/actions/offer.actions";
import {
  OFFER_COMPARE_MAX,
  type MarketplaceOfferView,
  type OfferClarificationView,
} from "@/domains/offer/types";
import type {
  OfferDecisionFilter,
  OfferDecisionSort,
  OfferHighlightBadge,
  OfferInsightCode,
  OfferRiskCode,
  PublicOfferDecision,
  PublicOfferDecisionBoard,
} from "@/domains/offer/recommendation";
import { filterAndSortDecisions } from "@/domains/offer/recommendation/client-filter";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/providers/star-rating";
import { Bookmark, BookmarkCheck, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyOffersIllustration } from "@/components/illustrations";

const initial: OfferActionState = { success: false };

const SORTS: OfferDecisionSort[] = [
  "recommended",
  "rating",
  "trust",
  "completed_jobs",
  "response_time",
  "price",
  "newest",
  "alphabetical",
];

export function CustomerOfferBoard({
  offers,
  selectionOfferId,
  clarificationsByOffer,
  decisionBoard = null,
}: {
  offers: MarketplaceOfferView[];
  selectionOfferId: string | null;
  clarificationsByOffer: Record<string, OfferClarificationView[]>;
  decisionBoard?: PublicOfferDecisionBoard | null;
}) {
  const t = useTranslations("offerFlow");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [sort, setSort] = useState<OfferDecisionSort>("recommended");
  const [filters, setFilters] = useState<OfferDecisionFilter[]>([]);
  const [shortlist, setShortlist] = useState<string[]>(
    decisionBoard?.shortlistedProviderIds ?? [],
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setShortlist(decisionBoard?.shortlistedProviderIds ?? []);
  }, [decisionBoard?.shortlistedProviderIds]);

  const decisionByOffer = useMemo(() => {
    const m = new Map<string, PublicOfferDecision>();
    for (const d of decisionBoard?.decisions ?? []) m.set(d.offerId, d);
    return m;
  }, [decisionBoard]);

  const { offers: visibleOffers, decisions: visibleDecisions } = useMemo(() => {
    if (!decisionBoard) {
      return { offers, decisions: [] as PublicOfferDecision[] };
    }
    return filterAndSortDecisions({
      offers,
      board: decisionBoard,
      sort,
      filters,
      shortlistedProviderIds: shortlist,
    });
  }, [offers, decisionBoard, sort, filters, shortlist]);

  const recommended = decisionBoard?.recommendedOfferId
    ? decisionByOffer.get(decisionBoard.recommendedOfferId)
    : null;
  const recommendedOffer = recommended
    ? offers.find((o) => o.id === recommended.offerId)
    : null;

  const compareOffers = useMemo(
    () =>
      visibleOffers
        .filter((o) => compareIds.includes(o.id))
        .slice(0, OFFER_COMPARE_MAX),
    [visibleOffers, compareIds],
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= OFFER_COMPARE_MAX) return prev;
      return [...prev, id];
    });
  };

  const toggleFilter = (f: OfferDecisionFilter) => {
    setFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  };

  const select = (offerId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await selectOfferAction(offerId);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      router.refresh();
    });
  };

  const decline = (offerId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await declineOfferAction(offerId);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      router.refresh();
    });
  };

  const toggleShortlist = (providerId: string, requestId: string) => {
    const was = shortlist.includes(providerId);
    setShortlist((prev) =>
      was ? prev.filter((id) => id !== providerId) : [...prev, providerId],
    );
    startTransition(async () => {
      const result = await toggleHiringShortlistAction({ requestId, providerId });
      if (!result.success) {
        setShortlist((prev) =>
          was ? [...prev, providerId] : prev.filter((id) => id !== providerId),
        );
        setError(result.error ?? "failed");
        return;
      }
      if (result.ids) setShortlist(result.ids);
    });
  };

  if (offers.length === 0) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-dashed border-border px-5 py-10 text-center animate-fade-in"
        role="status"
      >
        <div className="relative mx-auto mb-3 size-28">
          <EmptyOffersIllustration />
        </div>
        <p className="font-medium">{t("decision.emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("decision.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t("customer.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("customer.subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("customer.noContactYet")}</p>
      </div>

      {recommended && recommendedOffer ? (
        <section
          className="rounded-2xl border border-[var(--dalily-gold)]/40 bg-[var(--dalily-gold)]/8 p-4 transition-shadow"
          aria-label={t("decision.recommendedAria")}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="gap-1 bg-[var(--dalily-navy)] text-white">
              <Star className="size-3.5 fill-current" aria-hidden />
              {t("decision.recommendedBadge")}
            </Badge>
            {recommended.recommendationSummaryKey ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  `decision.summaries.${recommended.recommendationSummaryKey}` as "decision.summaries.high_satisfaction",
                )}
              </p>
            ) : null}
          </div>
          <DecisionAssistant decision={recommended} />
        </section>
      ) : null}

      {decisionBoard ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("decision.sortLabel")}</span>
            <select
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as OfferDecisionSort)}
              aria-label={t("decision.sortLabel")}
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`decision.sorts.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("decision.filtersLabel")}>
            {(
              [
                "verified_only",
                "available_now",
                "shortlisted",
              ] as OfferDecisionFilter[]
            ).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={filters.includes(f) ? "default" : "outline"}
                className="rounded-xl"
                aria-pressed={filters.includes(f)}
                onClick={() => toggleFilter(f)}
              >
                {t(`decision.filters.${f}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {compareOffers.length >= 2 ? (
        <CompareTable
          offers={compareOffers}
          decisions={compareOffers.map((o) => decisionByOffer.get(o.id))}
        />
      ) : null}

      {visibleOffers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center" role="status">
          <p className="text-sm text-muted-foreground">{t("decision.noMatches")}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 rounded-xl"
            onClick={() => setFilters([])}
          >
            {t("decision.clearFilters")}
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {visibleOffers.map((offer, idx) => {
            const decision = decisionByOffer.get(offer.id) ?? visibleDecisions[idx];
            const expanded = expandedId === offer.id;
            return (
              <li
                key={offer.id}
                className={cn(
                  "rounded-2xl border border-border p-4 transition-all duration-200",
                  decision?.isRecommended && "border-[var(--dalily-gold)]/50 shadow-sm",
                )}
              >
                <OfferCard
                  offer={offer}
                  decision={decision}
                  selected={selectionOfferId === offer.id}
                  shortlisted={shortlist.includes(offer.providerId)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="secondary" className="rounded-xl">
                    <Link
                      href={`/providers/${offer.providerId}?offerId=${offer.id}&requestId=${offer.serviceRequestId}`}
                    >
                      {t("customer.viewProfile")}
                    </Link>
                  </Button>
                  {!selectionOfferId && offer.status === "sent" ? (
                    <>
                      <Button
                        className="rounded-xl"
                        disabled={pending}
                        onClick={() => select(offer.id)}
                      >
                        {t("customer.accept")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={pending}
                        onClick={() => decline(offer.id)}
                      >
                        {t("customer.decline")}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={
                      !compareIds.includes(offer.id) &&
                      compareIds.length >= OFFER_COMPARE_MAX
                    }
                    onClick={() => toggleCompare(offer.id)}
                    aria-pressed={compareIds.includes(offer.id)}
                  >
                    {compareIds.includes(offer.id)
                      ? t("customer.removeCompare")
                      : t("customer.compare")}
                  </Button>
                  {decisionBoard ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl gap-1"
                      disabled={pending}
                      onClick={() =>
                        toggleShortlist(offer.providerId, offer.serviceRequestId)
                      }
                      aria-pressed={shortlist.includes(offer.providerId)}
                      aria-label={
                        shortlist.includes(offer.providerId)
                          ? t("decision.removeShortlist")
                          : t("decision.addShortlist")
                      }
                    >
                      {shortlist.includes(offer.providerId) ? (
                        <BookmarkCheck className="size-4" aria-hidden />
                      ) : (
                        <Bookmark className="size-4" aria-hidden />
                      )}
                      {t("decision.shortlist")}
                    </Button>
                  ) : null}
                  {decision ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl gap-1"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedId(expanded ? null : offer.id)
                      }
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          expanded && "rotate-180",
                        )}
                        aria-hidden
                      />
                      {t("decision.details")}
                    </Button>
                  ) : null}
                </div>
                {expanded && decision ? (
                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3 animate-fade-in">
                    <InsightList codes={decision.insights} />
                    <RiskList codes={decision.risks} />
                    <DecisionAssistant decision={decision} compact />
                  </div>
                ) : null}
                {offer.qualityFlags.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    {t("quality.nudge")}
                  </p>
                ) : null}
                <ClarificationThread
                  offerId={offer.id}
                  role="customer"
                  items={clarificationsByOffer[offer.id] ?? []}
                />
              </li>
            );
          })}
        </ul>
      )}

      {selectionOfferId ? (
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
          {t("customer.selectedPendingUnlock")}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}` as "errors.failed")}
        </p>
      ) : null}
    </div>
  );
}

function OfferCard({
  offer,
  decision,
  selected,
  compact,
  comparing,
  shortlisted,
}: {
  offer: MarketplaceOfferView;
  decision?: PublicOfferDecision;
  selected?: boolean;
  compact?: boolean;
  comparing?: boolean;
  shortlisted?: boolean;
}) {
  const t = useTranslations("offerFlow");
  const name = offer.providerName || t("customer.business");
  const displayName = offer.providerDisplayName?.trim() || null;
  const initial = (displayName || name).slice(0, 1).toUpperCase();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {offer.providerAvatarUrl ? (
            <Image
              src={offer.providerAvatarUrl}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-sm font-bold">
              {initial}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{name}</p>
            {offer.verificationStatus === "verified" ? (
              <PublicVerificationBadge providerId={offer.providerId} verified />
            ) : null}
            {decision?.isRecommended ? (
              <Badge className="bg-[var(--dalily-navy)] text-white">
                {t("decision.recommendedBadge")}
              </Badge>
            ) : null}
            {selected ? <Badge>{t("customer.selectedBadge")}</Badge> : null}
            {comparing ? <Badge variant="outline">{t("customer.comparing")}</Badge> : null}
            {shortlisted ? (
              <Badge variant="outline">{t("decision.shortlistedBadge")}</Badge>
            ) : null}
          </div>
          {displayName && displayName !== name ? (
            <p className="text-xs text-muted-foreground">{displayName}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {offer.ratingAvg != null && offer.ratingAvg > 0 ? (
              <>
                <StarRating rating={offer.ratingAvg} size="sm" />
                <span>{t("customer.rating", { rating: offer.ratingAvg.toFixed(1) })}</span>
              </>
            ) : null}
            {offer.completedJobs != null ? (
              <span>
                {t("customer.completedJobs", { count: offer.completedJobs })}
              </span>
            ) : null}
            {decision ? (
              <span>
                {t("decision.trustScore", { score: decision.compare.trustScorePct })}
              </span>
            ) : null}
          </div>
          {decision?.badges?.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {decision.badges.map((b) => (
                <Badge key={b} variant="secondary" className="text-[10px]">
                  {t(`decision.badges.${b}` as `decision.badges.${OfferHighlightBadge}`)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className="text-2xl font-bold">
        {offer.price} {offer.currency}
        <span className="ms-2 text-sm font-normal text-muted-foreground">
          {t(`priceModel.${offer.priceModel}`)}
        </span>
      </p>
      {offer.etaText ? (
        <p className="text-sm text-muted-foreground">
          {t("fields.eta")}: {offer.etaText}
        </p>
      ) : null}
      {!compact && offer.inclusions ? (
        <p className="text-sm whitespace-pre-wrap">{offer.inclusions}</p>
      ) : null}
      {!compact && offer.message ? (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{offer.message}</p>
      ) : null}
    </div>
  );
}

function DecisionAssistant({
  decision,
  compact,
}: {
  decision: PublicOfferDecision;
  compact?: boolean;
}) {
  const t = useTranslations("offerFlow.decision");
  if (!decision.assistantReasons.length) return null;
  return (
    <div className={cn(!compact && "mt-2")}>
      <p className="text-sm font-medium">{t("assistantTitle")}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm text-muted-foreground">
        {decision.assistantReasons.map((r) => (
          <li key={r}>{t(`assistant.${r}` as "assistant.excellent_reviews")}</li>
        ))}
      </ul>
    </div>
  );
}

function InsightList({ codes }: { codes: OfferInsightCode[] }) {
  const t = useTranslations("offerFlow.decision");
  if (!codes.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{t("insightsTitle")}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {codes.map((c) => (
          <li key={c}>
            <Badge variant="outline" className="font-normal">
              {t(`insights.${c}`)}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskList({ codes }: { codes: OfferRiskCode[] }) {
  const t = useTranslations("offerFlow.decision");
  if (!codes.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{t("risksTitle")}</p>
      <ul className="mt-1 space-y-1 text-sm text-amber-800 dark:text-amber-300">
        {codes.map((c) => (
          <li key={c}>{t(`risks.${c}`)}</li>
        ))}
      </ul>
    </div>
  );
}

function CompareTable({
  offers,
  decisions,
}: {
  offers: MarketplaceOfferView[];
  decisions: Array<PublicOfferDecision | undefined>;
}) {
  const t = useTranslations("offerFlow.decision");
  const rows: Array<{
    key: string;
    label: string;
    values: Array<string | number | boolean | null>;
    best?: "max" | "min";
  }> = [
    {
      key: "rating",
      label: t("compare.rating"),
      values: decisions.map((d) => d?.compare.ratingAvg ?? null),
      best: "max",
    },
    {
      key: "trust",
      label: t("compare.trust"),
      values: decisions.map((d) => d?.compare.trustScorePct ?? null),
      best: "max",
    },
    {
      key: "jobs",
      label: t("compare.jobs"),
      values: decisions.map((d) => d?.compare.completedJobs ?? null),
      best: "max",
    },
    {
      key: "response",
      label: t("compare.response"),
      values: decisions.map((d) => d?.compare.responseHoursAvg ?? null),
      best: "min",
    },
    {
      key: "accept",
      label: t("compare.acceptance"),
      values: decisions.map((d) => d?.compare.acceptanceRatePct ?? null),
      best: "max",
    },
    {
      key: "price",
      label: t("compare.price"),
      values: offers.map((o) => o.price),
      best: "min",
    },
    {
      key: "verified",
      label: t("compare.verified"),
      values: decisions.map((d) => d?.compare.verified ?? false),
    },
    {
      key: "portfolio",
      label: t("compare.portfolio"),
      values: decisions.map((d) => d?.compare.portfolioSize ?? 0),
      best: "max",
    },
  ];

  const isBest = (
    values: Array<string | number | boolean | null>,
    idx: number,
    mode?: "max" | "min",
  ) => {
    if (!mode) return false;
    const nums = values.map((v) => (typeof v === "number" ? v : null));
    const valid = nums.filter((n): n is number => n != null);
    if (valid.length < 2) return false;
    const target = mode === "max" ? Math.max(...valid) : Math.min(...valid);
    return nums[idx] === target;
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border" role="region" aria-label={t("compare.title")}>
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-start font-medium">{t("compare.metric")}</th>
            {offers.map((o) => (
              <th key={o.id} className="px-3 py-2 text-start font-medium">
                {o.providerName || "—"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/60">
              <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
              {row.values.map((v, i) => (
                <td
                  key={`${row.key}-${i}`}
                  className={cn(
                    "px-3 py-2",
                    isBest(row.values, i, row.best) && "font-semibold text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {typeof v === "boolean" ? (v ? t("compare.yes") : t("compare.no")) : v ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClarificationThread({
  offerId,
  role,
  items,
}: {
  offerId: string;
  role: "customer" | "provider";
  items: OfferClarificationView[];
}) {
  const t = useTranslations("offerFlow.qa");
  const [state, action, pending] = useActionState(postOfferClarificationAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border/80 p-3">
      <p className="text-xs font-medium text-muted-foreground">{t("title")}</p>
      <p className="text-[11px] text-muted-foreground">{t("hint")}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <span className="font-medium">
              {item.authorRole === "customer" ? t("customer") : t("provider")}:
            </span>{" "}
            {item.body}
          </li>
        ))}
      </ul>
      <form action={action} className="space-y-2">
        <input type="hidden" name="offerId" value={offerId} />
        <input type="hidden" name="role" value={role} />
        <Textarea
          name="body"
          rows={2}
          maxLength={500}
          placeholder={t("placeholder")}
          className="rounded-xl text-sm"
          required
        />
        <Button type="submit" size="sm" className="rounded-xl" disabled={pending}>
          {t("send")}
        </Button>
        {state.error ? (
          <p className="text-xs text-destructive" role="alert">
            {t(`errors.${state.error}` as "errors.failed")}
          </p>
        ) : null}
      </form>
    </div>
  );
}
