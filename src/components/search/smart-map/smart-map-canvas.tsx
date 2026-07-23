"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useTheme } from "next-themes";
import L from "leaflet";
import { createProviderDivIcon, createUserDivIcon } from "@/lib/smart-map/marker-icon";
import { resolveMarkerKind, type SmartMapProvider, type UserMapLocation } from "@/lib/smart-map/types";
import { getMapTileUrl, MAP_TILE_ATTRIBUTION } from "@/lib/smart-map/tiles";
import { SmartMapPreviewCard } from "@/components/search/smart-map/smart-map-preview-card";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

type Props = {
  providers: SmartMapProvider[];
  selectedId: string | null;
  userLocation: UserMapLocation | null;
  emergencySearch?: boolean;
  onSelect: (providerId: string) => void;
  onReady?: () => void;
  className?: string;
};

function FitBounds({
  providers,
  userLocation,
  selectedId,
}: {
  providers: SmartMapProvider[];
  userLocation: UserMapLocation | null;
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const selected = providers.find((p) => p.id === selectedId);
    if (selected) {
      map.panTo([selected.latitude, selected.longitude], { animate: true });
      return;
    }

    const points: L.LatLngExpression[] = providers.map((p) => [p.latitude, p.longitude]);
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [map, providers, userLocation, selectedId]);

  return null;
}

export function SmartMapCanvas({
  providers,
  selectedId,
  userLocation,
  emergencySearch = false,
  onSelect,
  onReady,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();
  const tileTheme = resolvedTheme === "dark" ? "dark" : "light";
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedId) ?? null,
    [providers, selectedId],
  );

  const center = useMemo<[number, number]>(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    if (providers[0]) return [providers[0].latitude, providers[0].longitude];
    return [33.5138, 36.2765];
  }, [providers, userLocation]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full rounded-2xl"
        scrollWheelZoom
        attributionControl
        keyboard
      >
        <TileLayer url={getMapTileUrl(tileTheme)} attribution={MAP_TILE_ATTRIBUTION} />
        <FitBounds
          providers={providers}
          userLocation={userLocation}
          selectedId={selectedId}
        />

        {userLocation ? (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserDivIcon()}
            keyboard={false}
            title="You"
          />
        ) : null}

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          maxClusterRadius={48}
          spiderfyOnMaxZoom
        >
          {providers.map((provider) => {
            const kind = resolveMarkerKind(provider, {
              selected: provider.id === selectedId,
              emergencySearch,
            });
            return (
              <Marker
                key={provider.id}
                position={[provider.latitude, provider.longitude]}
                icon={createProviderDivIcon(kind, provider.id === selectedId)}
                eventHandlers={{
                  click: () => onSelect(provider.id),
                }}
                title={provider.name}
                riseOnHover
              />
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {selectedProvider ? (
        <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-[1000] flex justify-center sm:inset-x-auto sm:start-3 sm:justify-start">
          <SmartMapPreviewCard
            provider={selectedProvider}
            emergencySearch={emergencySearch}
            onClose={() => onSelect("")}
          />
        </div>
      ) : null}
    </div>
  );
}
