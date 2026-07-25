"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  selectOfferAction,
  postOfferClarificationAction,
  type OfferActionState,
} from "@/actions/offer.actions";
import {
  OFFER_COMPARE_MAX,
  type MarketplaceOfferView,
  type OfferClarificationView,
} from "@/domains/offer/types";
import { Textarea } from "@/components/ui/textarea";

const initial: OfferActionState = { success: false };

export function CustomerOfferBoard({
  offers,
  selectionOfferId,
  clarificationsByOffer,
}: {
  offers: MarketplaceOfferView[];
  selectionOfferId: string | null;
  clarificationsByOffer: Record<string, OfferClarificationView[]>;
}) {
  const t = useTranslations("offerFlow");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const compareOffers = useMemo(
    () => offers.filter((o) => compareIds.includes(o.id)).slice(0, OFFER_COMPARE_MAX),
    [offers, compareIds],
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= OFFER_COMPARE_MAX) return prev;
      return [...prev, id];
    });
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

  if (offers.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t("customer.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("customer.subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("customer.noContactYet")}</p>
      </div>

      {compareOffers.length >= 2 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {compareOffers.map((o) => (
            <OfferCard
              key={`cmp-${o.id}`}
              offer={o}
              compact
              selected={selectionOfferId === o.id}
              comparing
            />
          ))}
        </div>
      ) : null}

      <ul className="space-y-4">
        {offers.map((offer) => (
          <li key={offer.id} className="rounded-2xl border border-border p-4">
            <OfferCard
              offer={offer}
              selected={selectionOfferId === offer.id}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {!selectionOfferId && offer.status === "sent" ? (
                <Button
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => select(offer.id)}
                >
                  {t("customer.select")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={
                  !compareIds.includes(offer.id) && compareIds.length >= OFFER_COMPARE_MAX
                }
                onClick={() => toggleCompare(offer.id)}
              >
                {compareIds.includes(offer.id)
                  ? t("customer.removeCompare")
                  : t("customer.compare")}
              </Button>
            </div>
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
        ))}
      </ul>

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
  selected,
  compact,
  comparing,
}: {
  offer: MarketplaceOfferView;
  selected?: boolean;
  compact?: boolean;
  comparing?: boolean;
}) {
  const t = useTranslations("offerFlow");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{offer.providerName || t("customer.business")}</p>
        {offer.verificationStatus === "verified" ? (
          <Badge variant="secondary">{t("customer.verified")}</Badge>
        ) : null}
        {selected ? <Badge>{t("customer.selectedBadge")}</Badge> : null}
        {comparing ? <Badge variant="outline">{t("customer.comparing")}</Badge> : null}
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
      {offer.ratingAvg != null && offer.ratingAvg > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("customer.rating", { rating: offer.ratingAvg.toFixed(1) })}
        </p>
      ) : null}
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
  const router = useRouter();
  const [state, action, pending] = useActionState(postOfferClarificationAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </p>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
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
          maxLength={500}
          rows={2}
          placeholder={t("placeholder")}
          className="rounded-xl"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="rounded-xl">
          {t("send")}
        </Button>
        {state.error ? (
          <p className="text-xs text-destructive">{t(`errors.${state.error}` as "errors.failed")}</p>
        ) : null}
      </form>
    </div>
  );
}
