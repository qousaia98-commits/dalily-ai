import L from "leaflet";
import { MARKER_COLORS, type MapMarkerKind } from "@/lib/smart-map/types";

export function createProviderDivIcon(kind: MapMarkerKind, selected: boolean): L.DivIcon {
  const color = MARKER_COLORS[selected ? "selected" : kind];
  const size = selected ? 36 : 28;
  const ring = selected ? "0 0 0 3px rgba(37,99,235,0.35)" : "0 2px 8px rgba(0,0,0,0.25)";

  return L.divIcon({
    className: "dalily-map-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `<span style="
      display:block;
      width:${size}px;
      height:${size}px;
      border-radius:9999px 9999px 9999px 4px;
      transform:rotate(-45deg);
      background:${color};
      border:2px solid #fff;
      box-shadow:${ring};
    "><span style="
      display:block;
      width:8px;
      height:8px;
      margin:${(size - 12) / 2}px auto 0;
      border-radius:9999px;
      background:#fff;
      transform:rotate(45deg);
    "></span></span>`,
  });
}

export function createUserDivIcon(): L.DivIcon {
  return L.divIcon({
    className: "dalily-user-marker",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<span style="
      display:block;
      width:18px;
      height:18px;
      border-radius:9999px;
      background:#2563EB;
      border:3px solid #fff;
      box-shadow:0 0 0 6px rgba(37,99,235,0.25);
    "></span>`,
  });
}
