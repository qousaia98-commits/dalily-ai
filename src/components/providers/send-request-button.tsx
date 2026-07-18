"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Camera, MapPin, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/routing";
import {
  createServiceRequestAction,
  type ServiceRequestActionState,
} from "@/actions/service-request.actions";
import { MAX_REQUEST_PHOTOS } from "@/lib/service-requests/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SuccessMoment } from "@/components/shared/success-moment";

const initialState: ServiceRequestActionState = { success: false };

type Props = {
  providerId: string;
  providerName: string;
  isLoggedIn: boolean;
  hasPendingRequest: boolean;
};

export function SendRequestButton({
  providerId,
  providerName,
  isLoggedIn,
  hasPendingRequest,
}: Props) {
  const t = useTranslations("serviceRequest");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [state, formAction, pending] = useActionState(
    createServiceRequestAction,
    initialState,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoCount, setPhotoCount] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setPhotoCount(0);
  }, []);

  useEffect(() => {
    if (state.success) {
      setSent(true);
      close();
      router.refresh();
    }
  }, [state.success, close, router]);

  if (!isLoggedIn) {
    const redirect = encodeURIComponent(`/providers/${providerId}`);
    return (
      <Button asChild className="min-h-12 w-full gap-2 rounded-2xl" size="lg">
        <Link href={`/login?redirect=${redirect}`}>
          <Send className="size-4" aria-hidden />
          {t("loginToSend")}
        </Link>
      </Button>
    );
  }

  if (hasPendingRequest || sent) {
    return (
      <div className="space-y-3">
        {sent ? (
          <SuccessMoment
            title={t("successSent")}
            body={t("successBody")}
            ctaHref={
              state.requestId
                ? `/account/requests/${state.requestId}`
                : "/account/requests"
            }
            ctaLabel={state.requestId ? t("viewRequest") : t("viewRequests")}
          />
        ) : (
          <>
            <div className="rounded-2xl border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-4 py-3 text-center text-sm text-muted-foreground">
              {t("pendingNotice")}
            </div>
            <Button asChild variant="outline" className="min-h-11 w-full rounded-2xl">
              <Link href="/account/requests">{t("viewRequests")}</Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        className="w-full gap-2 rounded-2xl bg-[var(--dalily-navy)] text-white hover:bg-[var(--dalily-navy)]/90"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <Send className="size-4" aria-hidden />
        {t("sendRequest")}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--dalily-navy-deep)_55%,transparent)] backdrop-blur-sm"
            aria-label={t("close")}
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-form-title"
            className={cn(
              "relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
              "animate-fade-in-up motion-reduce:animate-none",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-[var(--dalily-gold)] uppercase">
                  {t("eyebrow")}
                </p>
                <h2 id="request-form-title" className="text-lg font-bold">
                  {t("formTitle", { business: providerName })}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label={t("close")}
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={formAction} className="flex flex-1 flex-col overflow-hidden">
              <input type="hidden" name="providerId" value={providerId} />
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="request-title">{t("fields.title")}</Label>
                  <Input
                    id="request-title"
                    name="title"
                    required
                    maxLength={200}
                    placeholder={t("fields.titlePlaceholder")}
                    className="rounded-xl"
                  />
                  {state.fieldErrors?.title ? (
                    <p className="text-xs text-destructive">{t("errors.title")}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-description">{t("fields.description")}</Label>
                  <Textarea
                    id="request-description"
                    name="description"
                    required
                    rows={5}
                    maxLength={4000}
                    placeholder={t("fields.descriptionPlaceholder")}
                    className="min-h-[120px] rounded-xl resize-y"
                  />
                  {state.fieldErrors?.description ? (
                    <p className="text-xs text-destructive">{t("errors.description")}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="request-date" className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" aria-hidden />
                      {t("fields.preferredDate")}
                    </Label>
                    <Input
                      id="request-date"
                      name="preferredDate"
                      type="date"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="request-time">{t("fields.preferredTime")}</Label>
                    <Input
                      id="request-time"
                      name="preferredTime"
                      type="time"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-budget">{t("fields.budget")}</Label>
                  <Input
                    id="request-budget"
                    name="budget"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={t("fields.budgetPlaceholder")}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-location" className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" aria-hidden />
                    {t("fields.location")}
                  </Label>
                  <Input
                    id="request-location"
                    name="locationText"
                    maxLength={300}
                    placeholder={t("fields.locationPlaceholder")}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Camera className="size-3.5" aria-hidden />
                    {t("fields.photos")}
                  </Label>
                  <input
                    ref={fileRef}
                    type="file"
                    name="photos"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => setPhotoCount(Math.min(e.target.files?.length ?? 0, MAX_REQUEST_PHOTOS))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => fileRef.current?.click()}
                  >
                    {photoCount > 0
                      ? t("fields.photosSelected", { count: photoCount })
                      : t("fields.photosAdd")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("fields.photosHint")}</p>
                </div>

                {state.error && state.error !== "validation_error" ? (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                    {t(`errors.${state.error}` as "errors.create_failed")}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-border px-5 py-4">
                <p className="mb-3 text-xs text-muted-foreground">{t("privacyNote")}</p>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl"
                  disabled={pending}
                >
                  {pending ? t("submitting") : t("submit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
