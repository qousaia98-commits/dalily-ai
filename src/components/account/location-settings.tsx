"use client";

import { useCallback, useState, useTransition } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  disableLocationAction,
  enableLocationWithCoordsAction,
  refreshNearbyLocationAction,
} from "@/actions/location.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LocationPreference } from "@/lib/geo/location-preference";

type Props = {
  preference: LocationPreference | null;
  hasActiveLocation: boolean;
};

export function LocationSettings({ preference, hasActiveLocation }: Props) {
  const t = useTranslations("location.settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const enabled = preference === "enabled";
  const statusLabel = enabled ? t("statusEnabled") : t("statusDisabled");

  const requestCoords = useCallback(
    (onSuccess: (lat: number, lng: number) => Promise<{ success: boolean }>) => {
      setError(null);
      if (!navigator.geolocation) {
        setError(t("unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          startTransition(async () => {
            const result = await onSuccess(pos.coords.latitude, pos.coords.longitude);
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
    },
    [router, t],
  );

  const onEnable = useCallback(() => {
    requestCoords(enableLocationWithCoordsAction);
  }, [requestCoords]);

  const onUpdate = useCallback(() => {
    requestCoords(refreshNearbyLocationAction);
  }, [requestCoords]);

  const onDisable = useCallback(() => {
    setError(null);
    startTransition(async () => {
      await disableLocationAction();
      router.refresh();
    });
  }, [router]);

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--dalily-gold)_14%,transparent)] text-[var(--dalily-gold)]">
          <MapPin className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
            <Badge variant={enabled ? "default" : "secondary"}>{statusLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          {enabled && hasActiveLocation ? (
            <p className="text-xs text-muted-foreground">{t("activeNote")}</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
        {!enabled ? (
          <Button
            type="button"
            className="min-h-10 rounded-2xl"
            disabled={pending}
            onClick={onEnable}
          >
            {t("enable")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-10 rounded-2xl"
              disabled={pending}
              onClick={onUpdate}
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("update")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10 rounded-2xl"
              disabled={pending}
              onClick={onDisable}
            >
              {t("disable")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
