"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Navigation, Phone, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceKm } from "@/lib/geo/distance";
import {
  estimateTravelMinutes,
  type SmartMapProvider,
} from "@/lib/smart-map/types";
import { openExternalNavigation } from "@/lib/smart-map/navigation";
import { trackMapEventAction } from "@/actions/map.actions";
import { cn } from "@/lib/utils";

type Props = {
  provider: SmartMapProvider;
  emergencySearch?: boolean;
  onClose: () => void;
  className?: string;
};

export function SmartMapPreviewCard({
  provider,
  emergencySearch = false,
  onClose,
  className,
}: Props) {
  const t = useTranslations("search.smartMap");
  const travelMin = estimateTravelMinutes(provider.distanceKm);

  function handleNavigate() {
    void trackMapEventAction({
      event: "navigation_started",
      providerId: provider.id,
    });
    openExternalNavigation(provider.latitude, provider.longitude);
  }

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-xl",
        className,
      )}
      role="dialog"
      aria-label={provider.name}
    >
      <div className="flex items-start gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
          <Image src={provider.avatarImage} alt="" fill className="object-cover" sizes="48px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-bold text-foreground">{provider.name}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label={t("closePreview")}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="size-3.5 fill-[var(--dalily-gold)] text-[var(--dalily-gold)]" aria-hidden />
              {provider.rating.toFixed(1)}
              <span className="text-muted-foreground">({provider.reviewCount})</span>
            </span>
            {provider.distanceKm != null ? (
              <span>
                {t("distance", { km: formatDistanceKm(provider.distanceKm) })}
                {travelMin != null ? ` · ${t("travelTime", { minutes: travelMin })}` : ""}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {provider.verified ? <Badge variant="success">{t("verified")}</Badge> : null}
            {emergencySearch ? (
              <Badge variant="destructive">{t("emergency")}</Badge>
            ) : null}
            <Badge variant="outline">{t("hoursUnknown")}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button asChild size="sm" className="h-10 rounded-xl text-xs font-semibold">
          <Link href={provider.href}>{t("viewProfile")}</Link>
        </Button>
        {provider.phone ? (
          <Button asChild size="sm" variant="outline" className="h-10 rounded-xl text-xs font-semibold">
            <a href={`tel:${provider.phone}`}>
              <Phone className="me-1 size-3.5" aria-hidden />
              {t("call")}
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-10 rounded-xl text-xs" disabled>
            {t("call")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-10 rounded-xl text-xs font-semibold"
          onClick={handleNavigate}
        >
          <Navigation className="me-1 size-3.5" aria-hidden />
          {t("navigate")}
        </Button>
      </div>
    </div>
  );
}
