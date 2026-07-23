"use client";

import Image from "next/image";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { BadgeCheck, ThumbsUp } from "lucide-react";
import { StarRating } from "@/components/providers/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  toggleReviewHelpfulAction,
  trackReviewPhotoOpenAction,
  replyToReviewAction,
} from "@/actions/review.actions";
import type { PublicReview } from "@/lib/reviews/types";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/forms/field-error";
import { useClientFormValidation } from "@/hooks/use-client-form-validation";

type Props = {
  review: PublicReview;
  canVote: boolean;
  canReply?: boolean;
};

export function ReviewCard({ review, canVote, canReply = false }: Props) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const router = useRouter();
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(review.viewerHasVotedHelpful);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [replyState, replyAction, replyPending] = useActionState(replyToReviewAction, {
    success: false,
  });
  const formId = `reply-${review.id}`;
  const { fieldErrors, guardSubmit, getFieldA11y, requiredAttr, clearFieldError } =
    useClientFormValidation({ formId });

  useEffect(() => {
    if (replyState.success) router.refresh();
  }, [replyState.success, router]);

  const displayName = review.isAnonymous
    ? t("anonymous")
    : review.customerDisplayName || t("customer");

  const dateLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
  }).format(new Date(review.createdAt));

  function toggleHelpful() {
    if (!canVote) return;
    startTransition(async () => {
      const result = await toggleReviewHelpfulAction(review.id);
      if (!result.success) return;
      setVoted(Boolean(result.voted));
      if (typeof result.helpfulCount === "number") setHelpfulCount(result.helpfulCount);
    });
  }

  return (
    <article className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        <StarRating rating={review.rating} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {review.isVerified ? (
          <Badge variant="success" className="gap-1">
            <BadgeCheck className="size-3" aria-hidden />
            {t("verifiedBadge")}
          </Badge>
        ) : null}
        {review.verifiedBooking ? (
          <Badge variant="outline">{t("verifiedBooking")}</Badge>
        ) : null}
      </div>

      {review.comment ? (
        <p className="text-sm leading-relaxed text-foreground">{review.comment}</p>
      ) : null}

      {review.images.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {review.images.map((image) => (
            <li key={image.id}>
              <button
                type="button"
                className="relative size-20 overflow-hidden rounded-xl border border-border"
                onClick={() => {
                  setLightbox(image.url);
                  void trackReviewPhotoOpenAction(review.id, review.providerId);
                }}
                aria-label={t("openPhoto")}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="80px"
                  unoptimized
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {review.providerReply ? (
        <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("providerReply")}
          </p>
          <p className="mt-1 text-sm text-foreground">{review.providerReply}</p>
        </div>
      ) : canReply ? (
        <form
          action={replyAction}
          className="space-y-2 rounded-xl border border-dashed border-border p-3"
          noValidate
          onSubmit={guardSubmit}
        >
          <input type="hidden" name="reviewId" value={review.id} />
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={`reply-${review.id}`}>
            {t("providerReply")}
          </label>
          <Textarea
            id={`reply-${review.id}`}
            name="reply"
            rows={3}
            minLength={2}
            maxLength={2000}
            className="rounded-xl"
            placeholder={t("replyPlaceholder")}
            {...requiredAttr}
            {...getFieldA11y("reply")}
            onChange={() => clearFieldError("reply")}
          />
          <FieldError name="reply" formId={formId} message={fieldErrors.reply} />
          {replyState.error ? (
            <p className="text-sm text-destructive" role="alert">
              {t(`errors.${replyState.error}` as "errors.failed")}
            </p>
          ) : null}
          <Button type="submit" size="sm" className="rounded-xl" disabled={replyPending}>
            {replyPending ? t("replying") : t("submitReply")}
          </Button>
        </form>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={voted ? "secondary" : "outline"}
          size="sm"
          className={cn("h-10 gap-1.5 rounded-xl", !canVote && "opacity-60")}
          disabled={!canVote || pending}
          onClick={toggleHelpful}
          aria-pressed={voted}
        >
          <ThumbsUp className="size-3.5" aria-hidden />
          {t("helpful")}
          <span className="tabular-nums">({helpfulCount})</span>
        </Button>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("photoPreview")}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
        </div>
      ) : null}
    </article>
  );
}
