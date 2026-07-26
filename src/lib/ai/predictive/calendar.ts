/**
 * Calendar / season / holiday helpers for demand models.
 * Weather factor is architecture-ready (optional multiplier stub).
 */

import type { SeasonCode } from "./types";

/** Fixed Syria-centric civil holidays (approx; expandable). */
const SYRIA_HOLIDAY_MMDD = new Set([
  "01-01", // New Year
  "03-08", // Revolution Day
  "04-17", // Independence Day
  "05-01", // Labour Day
  "05-06", // Martyrs' Day
  "10-06", // October War anniversary
  "12-25", // Christmas (observed commercially)
]);

export function getSeason(date: Date): SeasonCode {
  const m = date.getUTCMonth() + 1;
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "autumn";
}

export function isHoliday(date: Date): boolean {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return SYRIA_HOLIDAY_MMDD.has(`${mm}-${dd}`);
}

export function dayOfWeek(date: Date): number {
  return date.getUTCDay(); // 0 Sun … 6 Sat
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Seasonal category multipliers (heuristic prior).
 * Winter → heating/HVAC; Summer → AC; Friday evening → electrical bump.
 */
export function seasonalCategoryMultiplier(
  categorySlug: string,
  season: SeasonCode,
): number {
  const c = categorySlug.toLowerCase();
  if (season === "winter") {
    if (c.includes("hvac") || c.includes("heating") || c.includes("plumb")) return 1.35;
    if (c.includes("electric")) return 1.15;
  }
  if (season === "summer") {
    if (c.includes("hvac") || c.includes("ac") || c.includes("cooling")) return 1.45;
    if (c.includes("electric")) return 1.2;
  }
  if (season === "spring" || season === "autumn") {
    if (c.includes("paint") || c.includes("clean")) return 1.15;
  }
  return 1;
}

export function fridayEveningBoost(
  categorySlug: string,
  dow: number,
  hour: number,
): number {
  const c = categorySlug.toLowerCase();
  // Friday evening (Syria weekend start): more electricians / emergency trades
  if (dow === 5 && hour >= 16 && hour <= 22) {
    if (c.includes("electric")) return 1.4;
    if (c.includes("plumb") || c.includes("lock")) return 1.25;
  }
  return 1;
}

/**
 * Weather-ready hook — returns 1.0 until a weather provider is wired.
 * Pass `weatherStress` 0–1 (storms / heat waves) to lift demand.
 */
export function weatherMultiplier(weatherStress: number | null | undefined): number {
  if (weatherStress == null || !Number.isFinite(weatherStress)) return 1;
  return 1 + Math.min(0.5, Math.max(0, weatherStress) * 0.5);
}
