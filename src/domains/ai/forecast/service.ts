/**
 * Forecast facade — advisory demand/supply insights via Forecast Engine domain.
 */

export { isForecastEngineEnabled } from "@/lib/config/feature-flags";

export async function forecastArchitectureNote(): Promise<string> {
  return "Use @/domains/forecast and admin/forecast — AI Platform never guarantees outcomes.";
}
