import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 8 Phase 3 — AI Demand Forecasting invariants.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = 0;

function ok(m) {
  console.log(`✓ ${m}`);
}
function fail(m) {
  console.error(`✗ ${m}`);
  failed += 1;
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("══ Demand Forecasting invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727150000_sprint8_ai_demand_forecasting.sql",
  "src/lib/forecast-engine/types.ts",
  "src/lib/forecast-engine/signals.ts",
  "src/lib/forecast-engine/weights.ts",
  "src/lib/forecast-engine/engine.ts",
  "src/lib/forecast-engine/explanations.ts",
  "src/lib/forecast-engine/collect.ts",
  "src/lib/forecast-engine/service.ts",
  "src/lib/forecast-engine/admin.ts",
  "src/lib/forecast-engine/market.ts",
  "src/lib/forecast-engine/observability.ts",
  "src/lib/forecast-engine/index.ts",
  "src/actions/forecast.actions.ts",
  "src/app/[locale]/(admin)/admin/forecast/page.tsx",
  "src/components/admin/admin-forecast-center-panel.tsx",
  "src/app/[locale]/(business)/business/forecast/page.tsx",
  "src/components/forecast/provider-forecast-insights-panel.tsx",
  "src/components/forecast/customer-demand-hint-card.tsx",
  "src/app/[locale]/(public)/account/forecast/page.tsx",
  "src/lib/ai/forecasting/index.ts",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read(
  "supabase/migrations/archive/20260727150000_sprint8_ai_demand_forecasting.sql",
);
for (const t of [
  "forecast_models",
  "forecast_history",
  "forecast_results",
  "forecast_accuracy",
  "forecast_explanations",
  "forecast_market_snapshots",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isForecastEngineEnabled") || flags.includes("isAiDemandForecastingEnabled"))
  ok("feature flag");
else fail("missing forecast feature flag");

const signals = read("src/lib/forecast-engine/signals.ts");
for (const s of [
  "historical_bookings",
  "category_demand",
  "regional_demand",
  "seasonality",
  "weekday_patterns",
  "holiday_calendar",
  "weather",
  "school_holidays",
  "provider_availability",
  "cancellation_trends",
  "economic_indicators",
  "ml_forecast",
]) {
  if (signals.includes(`"${s}"`)) ok(`signal ${s}`);
  else fail(`missing signal ${s}`);
}

const engine = read("src/lib/forecast-engine/engine.ts");
if (
  engine.includes("computeForecastFromSignals") &&
  engine.includes("ML_FORECAST_COLLECTOR") &&
  engine.includes("24h") &&
  engine.includes("90d") &&
  engine.includes("recommendedCapacity")
) {
  ok("modular engine + horizons + capacity");
} else fail("engine incomplete");

const expl = read("src/lib/forecast-engine/explanations.ts");
if (
  expl.includes("High demand expected") &&
  expl.includes("FORECAST_ADVISORY_NOTICE") &&
  !expl.includes("compositeFactor")
) {
  ok("public explanations + advisory notice");
} else fail("explanations incomplete");

const svc = read("src/lib/forecast-engine/service.ts");
if (
  svc.includes("toPublicDemandForecast") &&
  svc.includes("generateForecast") &&
  !svc.includes("guaranteeDemand")
) {
  ok("public forecast API (advisory)");
} else fail("public API incomplete");

if (svc.includes("isForecastEngineEnabled") || svc.includes("isAiDemandForecastingEnabled"))
  ok("flag-gated service");
else fail("service gating incomplete");

const bridge = read("src/lib/ai/forecasting/index.ts");
if (bridge.includes("sprint8-phase3") && bridge.includes("getPublicDemandForecasts")) {
  ok("ai/forecasting bridge");
} else fail("ai/forecasting bridge incomplete");

const obs = read("src/lib/forecast-engine/observability.ts");
for (const e of [
  "forecast_generated",
  "forecast_accepted",
  "forecast_accuracy",
  "model_version",
  "latency",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

const en = read("messages/en.json");
const ar = read("messages/ar.json");
if (en.includes('"forecast"') && ar.includes('"forecast"')) ok("i18n en/ar forecast keys");
else fail("i18n missing");

if (failed === 0) {
  console.log("\nAll demand forecasting invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
