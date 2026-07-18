"use client";

import { useCallback, useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  disableLocationAction,
  enableLocationWithCoordsAction,
  refreshNearbyLocationAction,
} from "@/actions/location.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  hasStoredLocation: boolean;
  locationEnabled: boolean;
  className?: string;
};

/**
 * Inline search-page control when location is enabled in settings.
 * Onboarding modal handles the first-time prompt globally.
 */
export function NearbyLocationPrompt({
  hasStoredLocation,
  locationEnabled,
  className,
}: Props) {
  const t = useTranslations("search.nearby");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRefresh = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setError(t("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(async () => {
          const action = hasStoredLocation
            ? refreshNearbyLocationAction
            : enableLocationWithCoordsAction;
          const result = await action(pos.coords.latitude, pos.coords.longitude);
          if (result.success) {
            router.refresh();
          } else {
            setError(t("saveFailed"));
          }
        });
      },
      () => setError(t("permissionDenied")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    );
  }, [hasStoredLocation, router, t]);

  const onClear = useCallback(() => {
    setError(null);
    startTransition(async () => {
      await disableLocationAction();
      router.refresh();
    });
  }, [router]);

  if (!locationEnabled) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>{t("cityMode")}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ms-auto h-8 rounded-xl"
          disabled={pending}
          onClick={onRefresh}
        >
          {t("enableFromSettings")}
        </Button>
      </div>
    );
  }

  if (!hasStoredLocation) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-card px-4 py-3 text-sm",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <MapPin className="size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
          <span className="text-muted-foreground">{t("refreshHint")}</span>
          <Button
            type="button"
            size="sm"
            className="ms-auto h-8 rounded-xl"
            disabled={pending}
            onClick={onRefresh}
          >
            {t("refresh")}
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <MapPin className="size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
      <span>{t("active")}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ms-auto h-8 rounded-xl"
        disabled={pending}
        onClick={onRefresh}
      >
        {t("refresh")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 rounded-xl"
        disabled={pending}
        onClick={onClear}
      >
        {t("clear")}
      </Button>
      {error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
