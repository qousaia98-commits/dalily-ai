"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  selectOfferAction,
  declineOfferAction,
} from "@/actions/offer.actions";

type Props = {
  offerId: string;
  requestId: string;
  canDecide: boolean;
  backHref?: string;
};

/** Sticky Accept / Decline / Gallery / Reviews bar for trust profile offer context. */
export function OfferDecisionBar({
  offerId,
  requestId,
  canDecide,
  backHref,
}: Props) {
  const t = useTranslations("offerFlow.customer");
  const te = useTranslations("offerFlow.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const returnTo = backHref ?? `/request/${requestId}/waiting`;

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await selectOfferAction(offerId);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      router.push(returnTo);
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineOfferAction(offerId);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      router.push(returnTo);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-3 sm:px-6">
        <p className="text-xs text-muted-foreground sm:hidden">{t("trustBarHint")}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <a href="#provider-gallery">{t("viewGallery")}</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <a href="#provider-reviews">{t("viewReviews")}</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-xl hidden sm:inline-flex">
              <Link href={returnTo}>{t("back")}</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-xl sm:hidden">
              <Link href={returnTo}>{t("back")}</Link>
            </Button>
            {canDecide ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={decline}
                >
                  {t("decline")}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={accept}
                >
                  {t("accept")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <p className="mx-auto max-w-4xl px-4 pb-3 text-sm text-destructive sm:px-6" role="alert">
          {error === "login_required" ||
          error === "forbidden" ||
          error === "offer_not_found" ||
          error === "already_selected" ||
          error === "decline_failed" ||
          error === "feature_disabled"
            ? te(error)
            : te("failed")}
        </p>
      ) : null}
    </div>
  );
}
