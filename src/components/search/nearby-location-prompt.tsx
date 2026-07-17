"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  clearNearbyLocationAction,
  saveNearbyLocationAction,
} from "@/actions/messaging.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DENIED_KEY = "dalily_loc_denied";

type Props = {
  hasStoredLocation: boolean;
  className?: string;
};

/**
 * Asks once for location to power nearby search.
 * GPS is only used ephemerally (short-lived cookie) — never permanently stored.
 */
export function NearbyLocationPrompt({ hasStoredLocation, className }: Props) {
  const t = useTranslations("search.nearby");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasStoredLocation) {
      setVisible(false);
      return;
    }
    try {
      if (typeof window !== "undefined" && localStorage.getItem(DENIED_KEY) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [hasStoredLocation]);

  const onAllow = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setError(t("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(async () => {
          const result = await saveNearbyLocationAction(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (result.success) {
            setVisible(false);
            router.refresh();
          } else {
            setError(t("saveFailed"));
          }
        });
      },
      () => {
        try {
          localStorage.setItem(DENIED_KEY, "1");
        } catch {
          /* ignore */
        }
        setVisible(false);
        setError(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    );
  }, [router, t]);

  const onDeny = useCallback(() => {
    try {
      localStorage.setItem(DENIED_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
    startTransition(async () => {
      await clearNearbyLocationAction();
      router.refresh();
    });
  }, [router]);

  if (!visible && !hasStoredLocation) {
    if (!error) return null;
  }

  if (!visible && hasStoredLocation) {
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
          onClick={onDeny}
        >
          {t("clear")}
        </Button>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t("title")}
      className={cn(
        "rounded-2xl border border-border bg-card px-4 py-4 shadow-sm",
        className,
      )}
    >
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <MapPin className="size-5 text-[var(--dalily-gold)]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-foreground">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className="rounded-2xl"
              disabled={pending}
              onClick={onAllow}
            >
              {t("allow")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={pending}
              onClick={onDeny}
            >
              {t("deny")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
