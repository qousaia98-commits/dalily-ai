"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  declineLocationAction,
  enableLocationWithCoordsAction,
} from "@/actions/location.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Server knows whether the user already chose enabled/disabled */
  shouldShow: boolean;
};

/**
 * One-time location onboarding after first launch or login.
 * GPS is never stored permanently — only a short-lived session cookie.
 */
export function LocationOnboardingModal({ shouldShow }: Props) {
  const t = useTranslations("location.onboarding");
  const router = useRouter();
  const [open, setOpen] = useState(shouldShow);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpen(shouldShow);
  }, [shouldShow]);

  const close = useCallback(() => setOpen(false), []);

  const onAllow = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setError(t("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(async () => {
          const result = await enableLocationWithCoordsAction(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (result.success) {
            close();
            router.refresh();
          } else {
            setError(t("saveFailed"));
          }
        });
      },
      () => {
        startTransition(async () => {
          await declineLocationAction();
          close();
          router.refresh();
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    );
  }, [close, router, t]);

  const onDecline = useCallback(() => {
    startTransition(async () => {
      await declineLocationAction();
      close();
      router.refresh();
    });
  }, [close, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--dalily-navy-deep)_55%,transparent)] backdrop-blur-sm"
        aria-label={t("dismiss")}
        onClick={onDecline}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-onboard-title"
        aria-describedby="loc-onboard-body"
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
          "animate-fade-in-up motion-reduce:animate-none",
        )}
      >
        <div className="pointer-events-none absolute -end-8 -top-8 size-32 rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_18%,transparent)] blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -start-6 size-28 rounded-full bg-[color-mix(in_oklab,var(--dalily-navy)_12%,transparent)] blur-2xl" />

        <div className="relative space-y-5 p-6 sm:p-8">
          <button
            type="button"
            className="absolute end-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onDecline}
            aria-label={t("dismiss")}
          >
            <X className="size-4" />
          </button>

          <span className="flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--dalily-gold)_16%,var(--card))] text-[var(--dalily-gold)]">
            <MapPin className="size-7" aria-hidden />
          </span>

          <div className="space-y-2 pe-8">
            <h2 id="loc-onboard-title" className="text-xl font-bold tracking-tight text-foreground">
              {t("title")}
            </h2>
            <p id="loc-onboard-body" className="text-sm leading-relaxed text-muted-foreground">
              {t("body")}
            </p>
            <p className="text-xs text-muted-foreground">{t("privacy")}</p>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-12 flex-1 rounded-2xl"
              disabled={pending}
              onClick={onAllow}
            >
              {t("allow")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl"
              disabled={pending}
              onClick={onDecline}
            >
              {t("notNow")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
