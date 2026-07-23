"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { List, Map as MapIcon, X } from "lucide-react";
import { trackMapEventAction } from "@/actions/map.actions";
import type { SmartMapProvider, UserMapLocation } from "@/lib/smart-map/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SmartMapCanvas = dynamic(
  () =>
    import("@/components/search/smart-map/smart-map-canvas").then((m) => m.SmartMapCanvas),
  {
    ssr: false,
    loading: () => <SmartMapLoadingPlaceholder />,
  },
);

function SmartMapLoadingPlaceholder() {
  const t = useTranslations("search.smartMap");
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-border bg-muted/40 text-sm text-muted-foreground">
      {t("loading")}
    </div>
  );
}

type Props = {
  providers: SmartMapProvider[];
  userLocation: UserMapLocation | null;
  emergencySearch?: boolean;
  children: React.ReactNode;
};

export function SmartMapSearchLayout({
  providers,
  userLocation,
  emergencySearch = false,
  children,
}: Props) {
  const t = useTranslations("search.smartMap");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const openedTracked = useRef(false);

  const scrollToCard = useCallback((providerId: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-provider-card="${providerId}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const selectProvider = useCallback(
    (providerId: string, source: "list" | "marker") => {
      if (!providerId) {
        setSelectedId(null);
        return;
      }
      setSelectedId(providerId);
      if (source === "marker") {
        void trackMapEventAction({ event: "marker_clicked", providerId });
        scrollToCard(providerId);
      } else {
        void trackMapEventAction({ event: "provider_selected", providerId });
      }
    },
    [scrollToCard],
  );

  useEffect(() => {
    if ((!mapMounted && !mobileMapOpen) || openedTracked.current) return;
    openedTracked.current = true;
    void trackMapEventAction({ event: "map_opened" });
  }, [mapMounted, mobileMapOpen]);

  // Keyboard: Escape closes mobile map / clears selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (mobileMapOpen) setMobileMapOpen(false);
      else setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMapOpen]);

  const mapProps = {
    providers,
    selectedId,
    userLocation,
    emergencySearch,
    onSelect: (id: string) => selectProvider(id, "marker"),
  };

  if (providers.length === 0) {
    return <div>{children}</div>;
  }

  return (
    <div className="relative">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,42%)] lg:items-start">
        <div
          ref={listRef}
          className="min-w-0"
          onFocusCapture={(e) => {
            const target = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-provider-card]",
            );
            const id = target?.dataset.providerCard;
            if (id) selectProvider(id, "list");
          }}
          onMouseOver={(e) => {
            const target = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-provider-card]",
            );
            const id = target?.dataset.providerCard;
            if (id && id !== selectedId) setSelectedId(id);
          }}
        >
          <div
            className={cn(
              "grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2",
              "[&_[data-provider-card]]:scroll-mt-24",
              selectedId &&
                `[&_[data-provider-card="${selectedId}"]]:ring-2 [&_[data-provider-card="${selectedId}"]]:ring-[var(--dalily-gold)] [&_[data-provider-card="${selectedId}"]]:ring-offset-2`,
            )}
          >
            {children}
          </div>
        </div>

        {/* Desktop sticky map */}
        <aside
          className="relative sticky top-24 hidden h-[min(70vh,640px)] lg:block"
          aria-label={t("mapRegionLabel")}
        >
          <SmartMapCanvas
            {...mapProps}
            className="relative h-full w-full overflow-hidden rounded-2xl border border-border"
            onReady={() => setMapMounted(true)}
          />
          <p className="sr-only">{t("syncHint")}</p>
        </aside>
      </div>

      {/* Mobile: Show Map FAB */}
      <Button
        type="button"
        className="fixed end-4 bottom-20 z-40 h-12 gap-2 rounded-full px-5 shadow-lg lg:hidden"
        onClick={() => setMobileMapOpen(true)}
        aria-label={t("showMap")}
      >
        <MapIcon className="size-4" aria-hidden />
        {t("showMap")}
      </Button>

      {/* Mobile fullscreen map */}
      {mobileMapOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("mapRegionLabel")}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="font-semibold text-foreground">{t("mapTitle")}</p>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              onClick={() => setMobileMapOpen(false)}
            >
              <List className="size-4" aria-hidden />
              {t("showList")}
            </Button>
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              onClick={() => setMobileMapOpen(false)}
              aria-label={t("closeMap")}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <SmartMapCanvas {...mapProps} className="relative h-full w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
