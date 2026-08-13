"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  emergencyProviderRespondAction,
  shareEmergencyLiveLocationAction,
} from "@/actions/emergency.actions";
import type { EmergencyProviderResponse } from "@/lib/ai/dispatch/emergency";
import { toast } from "sonner";
import { MapPin, Navigation } from "lucide-react";

type Props = {
  serviceRequestId: string;
  assignmentId: string;
  locationText?: string | null;
  navigationUrl?: string | null;
};

const QUICK: Array<{
  response: EmergencyProviderResponse;
  key: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
}> = [
  { response: "accepted", key: "accept", variant: "default" },
  { response: "on_the_way", key: "onMyWay", variant: "secondary" },
  { response: "busy", key: "busy", variant: "outline" },
  { response: "declined", key: "decline", variant: "destructive" },
];

export function EmergencyQuickActions({
  serviceRequestId,
  assignmentId,
  locationText,
  navigationUrl,
}: Props) {
  const t = useTranslations("offerFlow.provider.emergencyActions");
  const [pending, startTransition] = useTransition();
  const [sharing, setSharing] = useState(false);

  function respond(response: EmergencyProviderResponse) {
    startTransition(async () => {
      const result = await emergencyProviderRespondAction({
        serviceRequestId,
        assignmentId,
        response,
        etaMinutes: response === "accepted" || response === "on_the_way" ? 35 : null,
      });
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t(`success.${response}` as "success.accepted"));
    });
  }

  function openNav() {
    const url =
      navigationUrl ||
      (locationText
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`
        : null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.message(t("noLocation"));
  }

  function toggleShareLocation() {
    if (!navigator.geolocation) {
      toast.error(t("geoUnsupported"));
      return;
    }
    if (sharing) {
      setSharing(false);
      startTransition(async () => {
        await shareEmergencyLiveLocationAction({
          serviceRequestId,
          sharingEnabled: false,
        });
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSharing(true);
        startTransition(async () => {
          const result = await shareEmergencyLiveLocationAction({
            serviceRequestId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            sharingEnabled: true,
          });
          if (!result.ok) {
            setSharing(false);
            toast.error(t("locationError"));
            return;
          }
          toast.success(t("locationShared"));
        });
      },
      () => toast.error(t("locationError")),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
          {t("badge")}
        </p>
        <p className="mt-1 text-sm font-medium">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUICK.map((q) => (
          <Button
            key={q.response}
            type="button"
            variant={q.variant ?? "outline"}
            size="sm"
            disabled={pending}
            onClick={() => respond(q.response)}
            className="h-11"
          >
            {t(q.key)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={openNav}
        >
          <Navigation className="size-3.5" />
          {t("navigate")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={pending}
          onClick={toggleShareLocation}
        >
          <MapPin className="size-3.5" />
          {sharing ? t("stopShare") : t("shareLocation")}
        </Button>
      </div>
    </div>
  );
}
