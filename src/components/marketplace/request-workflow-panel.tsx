"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  acceptQuoteAction,
  completeServiceAction,
  confirmCompletionAction,
  declineQuoteAction,
  requestQuoteChangesAction,
  sendQuoteAction,
  submitReviewAction,
  reportProblemAction,
  type ServiceRequestActionState,
} from "@/actions/service-request.actions";
import { RequestTimeline } from "@/components/marketplace/request-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";
import {
  canChat,
  canCompleteService,
  canConfirmCompletion,
  canDecideQuote,
  canReview,
  canSendQuote,
  nextStepHint,
} from "@/lib/service-requests/status-machine";
import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";

const initial: ServiceRequestActionState = { success: false };

type Props = {
  request: ServiceRequestDetail;
  viewer: "customer" | "business";
  userId: string;
  providerId?: string | null;
};

export function RequestWorkflowPanel({ request, viewer, userId, providerId }: Props) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  useMarketplaceRealtime({
    userId,
    providerId,
    requestId: request.id,
    conversationId: request.conversationId,
  });

  const run = (fn: () => Promise<ServiceRequestActionState>, opts?: { openChat?: boolean }) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      if (opts?.openChat && result.conversationId) {
        router.push(
          viewer === "business"
            ? `/business/messages/${result.conversationId}`
            : `/messages/${result.conversationId}`,
        );
      }
      router.refresh();
    });
  };

  const nextKey = nextStepHint(request.status, viewer);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
          <Badge variant="secondary">{t(`status.${request.status}`)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {viewer === "business"
            ? t("fromCustomer", { name: request.customerName })
            : t("withBusiness", { name: request.providerName })}
        </p>
        <p className="rounded-2xl border border-[var(--dalily-gold)]/25 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-3 py-2 text-sm">
          <span className="font-medium">{t("nextStep")}: </span>
          {t(nextKey)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("summary")}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>
            {request.imageUrls && request.imageUrls.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {request.imageUrls.map((url) => (
                  <li key={url} className="overflow-hidden rounded-2xl border border-border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-square h-full w-full object-cover" />
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              {request.preferred_date ? (
                <div>
                  <dt className="inline font-medium">{t("preferredDate")}: </dt>
                  <dd className="inline">{request.preferred_date}</dd>
                </div>
              ) : null}
              {request.budget != null ? (
                <div>
                  <dt className="inline font-medium">{t("budget")}: </dt>
                  <dd className="inline">
                    {request.budget} {request.currency ?? "SYP"}
                  </dd>
                </div>
              ) : null}
              {request.location_text ? (
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">{t("location")}: </dt>
                  <dd className="inline">{request.location_text}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {request.quote ? (
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("quote.title")}
              </h2>
              <p className="text-2xl font-bold text-foreground">
                {request.quote.price} {request.quote.currency}
              </p>
              {request.quote.estimated_duration_text ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("quote.duration")}: {request.quote.estimated_duration_text}
                </p>
              ) : null}
              {request.quote.notes ? (
                <p className="mt-2 text-sm whitespace-pre-wrap">{request.quote.notes}</p>
              ) : null}

              {viewer === "customer" && canDecideQuote(request.status) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="min-h-11 rounded-2xl"
                    disabled={pending}
                    onClick={() => run(() => acceptQuoteAction(request.id))}
                  >
                    {t("quote.accept")}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-2xl"
                    disabled={pending}
                    onClick={() => run(() => declineQuoteAction(request.id))}
                  >
                    {t("quote.decline")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11 rounded-2xl"
                    disabled={pending}
                    onClick={() => run(() => requestQuoteChangesAction(request.id))}
                  >
                    {t("quote.requestChanges")}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {viewer === "business" && canSendQuote(request.status) ? (
            <QuoteForm requestId={request.id} />
          ) : null}

          {viewer === "business" && canCompleteService(request.status) ? (
            <div className="sticky bottom-20 z-10 rounded-3xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur md:bottom-4">
              {!showCompleteConfirm ? (
                <Button
                  className="h-12 w-full rounded-2xl"
                  disabled={pending}
                  onClick={() => setShowCompleteConfirm(true)}
                >
                  {t("complete.cta")}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("complete.confirmBody")}</p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-2xl"
                      disabled={pending}
                      onClick={() => run(() => completeServiceAction(request.id))}
                    >
                      {t("complete.confirm")}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => setShowCompleteConfirm(false)}
                    >
                      {t("complete.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {viewer === "customer" && canConfirmCompletion(request.status) ? (
            <section className="rounded-3xl border border-[var(--dalily-gold)]/30 bg-card p-5 shadow-sm">
              <p className="text-sm font-medium">{t("confirm.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("confirm.body")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  className="rounded-2xl"
                  disabled={pending}
                  onClick={() => run(() => confirmCompletionAction(request.id))}
                >
                  {t("confirm.confirm")}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setShowDispute(true)}
                >
                  {t("confirm.report")}
                </Button>
              </div>
              {showDispute ? <DisputeForm requestId={request.id} /> : null}
            </section>
          ) : null}

          {viewer === "customer" && canReview(request.status) ? (
            <ReviewForm requestId={request.id} />
          ) : null}

          {request.review ? (
            <section className="rounded-3xl border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t("review.title")}
              </h2>
              <p className="text-lg font-bold">{request.review.rating}/5</p>
              {request.review.comment ? (
                <p className="mt-2 text-sm whitespace-pre-wrap">{request.review.comment}</p>
              ) : null}
            </section>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {t(`errors.${error}` as "errors.failed")}
            </p>
          ) : null}

          {request.conversationId && canChat(request.status) ? (
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-2xl"
              onClick={() =>
                router.push(
                  viewer === "business"
                    ? `/business/messages/${request.conversationId}`
                    : `/messages/${request.conversationId}`,
                )
              }
            >
              {t("openChat")}
            </Button>
          ) : null}
        </div>

        <aside className="rounded-3xl border border-border bg-card p-5 shadow-sm h-fit">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {t("timeline.label")}
          </h2>
          <RequestTimeline status={request.status} hasQuote={Boolean(request.quote)} />
        </aside>
      </div>
    </div>
  );
}

function QuoteForm({ requestId }: { requestId: string }) {
  const t = useTranslations("marketplace.quote");
  const te = useTranslations("marketplace.errors");
  const router = useRouter();
  const [state, action, pending] = useActionState(sendQuoteAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <input type="hidden" name="requestId" value={requestId} />
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {t("sendTitle")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="price">{t("price")}</Label>
          <Input id="price" name="price" type="number" min={0} step="0.01" required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{t("currency")}</Label>
          <Input id="currency" name="currency" defaultValue="SYP" className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimatedDuration">{t("duration")}</Label>
        <Input
          id="estimatedDuration"
          name="estimatedDuration"
          placeholder={t("durationPlaceholder")}
          className="rounded-xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={3} className="rounded-xl" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {te(state.error as "failed")}
        </p>
      ) : null}
      <Button type="submit" className="w-full rounded-2xl" disabled={pending}>
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}

function DisputeForm({ requestId }: { requestId: string }) {
  const t = useTranslations("marketplace.confirm");
  const te = useTranslations("marketplace.errors");
  const router = useRouter();
  const [state, action, pending] = useActionState(reportProblemAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-border pt-4">
      <input type="hidden" name="requestId" value={requestId} />
      <Label htmlFor="note">{t("disputeNote")}</Label>
      <Textarea id="note" name="note" required rows={3} className="rounded-xl" />
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {te(state.error as "failed")}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" className="rounded-2xl" disabled={pending}>
        {t("submitDispute")}
      </Button>
    </form>
  );
}

function ReviewForm({ requestId }: { requestId: string }) {
  const t = useTranslations("marketplace.review");
  const te = useTranslations("marketplace.errors");
  const router = useRouter();
  const [state, action, pending] = useActionState(submitReviewAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className={cn("space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm")}>
      <input type="hidden" name="requestId" value={requestId} />
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("formTitle")}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="rating">{t("rating")}</Label>
        <Input id="rating" name="rating" type="number" min={1} max={5} required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="comment">{t("comment")}</Label>
        <Textarea id="comment" name="comment" rows={4} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="recommend">{t("recommend")}</Label>
        <select
          id="recommend"
          name="recommend"
          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          defaultValue=""
        >
          <option value="">{t("recommendSkip")}</option>
          <option value="yes">{t("recommendYes")}</option>
          <option value="no">{t("recommendNo")}</option>
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {te(state.error as "failed")}
        </p>
      ) : null}
      <Button type="submit" className="w-full rounded-2xl" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
