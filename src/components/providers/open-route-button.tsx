"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Opens Google Maps / Apple Maps directions — no embedded map.
 */
export function OpenRouteButton({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label?: string;
}) {
  const t = useTranslations("provider");
  const dest = `${lat},${lng}`;

  function openRoute(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const href = isApple
      ? `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <Button asChild variant="outline" className="w-full gap-2 rounded-2xl" size="lg">
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`}
        onClick={openRoute}
        aria-label={t("openRouteAria")}
      >
        <ExternalLink className="size-4" aria-hidden />
        {label ?? t("openRoute")}
      </a>
    </Button>
  );
}
