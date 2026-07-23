"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  buildNavigationUrl,
  openExternalNavigation,
} from "@/lib/smart-map/navigation";

/**
 * Opens Google Maps / Apple Maps / OSM directions — no embedded map.
 */
export function OpenRouteButton({
  lat,
  lng,
  label,
  onNavigate,
}: {
  lat: number;
  lng: number;
  label?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("provider");
  const href = buildNavigationUrl(lat, lng);

  function openRoute(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onNavigate?.();
    openExternalNavigation(lat, lng);
  }

  return (
    <Button asChild variant="outline" className="w-full gap-2 rounded-2xl" size="lg">
      <a href={href} onClick={openRoute} aria-label={t("openRouteAria")}>
        <ExternalLink className="size-4" aria-hidden />
        {label ?? t("openRoute")}
      </a>
    </Button>
  );
}
