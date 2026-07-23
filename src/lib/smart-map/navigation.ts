/**
 * External navigation URLs — extends the OpenRouteButton pattern.
 * Chooses Apple Maps on Apple devices, otherwise Google Maps; OSM always available.
 */

export type NavigationProvider = "apple" | "google" | "osm";

export function detectPreferredNavigationProvider(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): NavigationProvider {
  if (/iPhone|iPad|iPod|Macintosh/.test(userAgent)) return "apple";
  return "google";
}

export function buildNavigationUrl(
  lat: number,
  lng: number,
  provider: NavigationProvider = detectPreferredNavigationProvider(),
): string {
  const dest = `${lat},${lng}`;
  switch (provider) {
    case "apple":
      return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`;
    case "osm":
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat}%2C${lng}#map=16/${lat}/${lng}`;
    case "google":
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }
}

export function openExternalNavigation(lat: number, lng: number): void {
  const href = buildNavigationUrl(lat, lng);
  window.open(href, "_blank", "noopener,noreferrer");
}
