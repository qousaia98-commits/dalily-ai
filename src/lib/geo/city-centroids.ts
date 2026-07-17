/** Approximate city centroids (Syria) — fallback when DB city coords missing. */
export const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  damascus: { lat: 33.5138, lng: 36.2765 },
  aleppo: { lat: 36.2021, lng: 37.1343 },
  homs: { lat: 34.7268, lng: 36.7234 },
  latakia: { lat: 35.5317, lng: 35.7906 },
  hama: { lat: 35.1318, lng: 36.7578 },
  tartus: { lat: 34.889, lng: 35.8866 },
};

/** Damascus districts for privacy-safe insight labels (never customer GPS). */
export const SAMPLE_DISTRICT_LABELS = {
  en: ["Mazzeh", "Abu Rummaneh", "Kafr Sousa", "Muhajireen", "Maliki"],
  ar: ["المزة", "أبو رمانة", "كفر سوسة", "المهاجرين", "المالكي"],
} as const;
