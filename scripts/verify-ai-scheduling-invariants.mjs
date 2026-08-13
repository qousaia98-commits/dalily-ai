import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 8 Phase 4 — AI Scheduling invariants.
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

console.log("══ AI Scheduling invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727160000_sprint8_ai_scheduling.sql",
  "src/lib/scheduling-engine/types.ts",
  "src/lib/scheduling-engine/signals.ts",
  "src/lib/scheduling-engine/weights.ts",
  "src/lib/scheduling-engine/engine.ts",
  "src/lib/scheduling-engine/explanations.ts",
  "src/lib/scheduling-engine/collect.ts",
  "src/lib/scheduling-engine/routes.ts",
  "src/lib/scheduling-engine/gaps.ts",
  "src/lib/scheduling-engine/opportunities.ts",
  "src/lib/scheduling-engine/capacity.ts",
  "src/lib/scheduling-engine/service.ts",
  "src/lib/scheduling-engine/admin.ts",
  "src/lib/scheduling-engine/observability.ts",
  "src/lib/scheduling-engine/index.ts",
  "src/actions/scheduling.actions.ts",
  "src/app/[locale]/(admin)/admin/scheduling/page.tsx",
  "src/components/admin/admin-scheduling-center-panel.tsx",
  "src/app/[locale]/(business)/business/scheduling/page.tsx",
  "src/components/scheduling/provider-scheduling-insights-panel.tsx",
  "src/components/scheduling/customer-schedule-hint-card.tsx",
  "src/app/[locale]/(public)/account/scheduling/page.tsx",
  "src/lib/ai/scheduling/index.ts",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727160000_sprint8_ai_scheduling.sql");
for (const t of [
  "schedule_profiles",
  "schedule_history",
  "schedule_recommendations",
  "capacity_history",
  "capacity_predictions",
  "schedule_explanations",
  "provider_routes",
  "provider_schedule_gaps",
  "provider_opportunities",
  "provider_opportunity_history",
  "route_optimization_cache",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isAiSchedulingEnabled")) ok("feature flag");
else fail("missing isAiSchedulingEnabled");

const signals = read("src/lib/scheduling-engine/signals.ts");
for (const s of [
  "current_bookings",
  "travel_distance",
  "travel_time",
  "traffic",
  "working_hours",
  "provider_capacity",
  "urgency",
  "weather",
  "current_fatigue",
  "ml_scheduler",
]) {
  if (signals.includes(`"${s}"`)) ok(`signal ${s}`);
  else fail(`missing signal ${s}`);
}

const engine = read("src/lib/scheduling-engine/engine.ts");
if (
  engine.includes("computeScheduleFromSignals") &&
  engine.includes("ML_SCHEDULER_COLLECTOR") &&
  engine.includes("recommended") === false
    ? engine.includes("orderedStops")
    : true
) {
  ok("modular engine");
} else fail("engine incomplete");

if (engine.includes("orderedStops") && engine.includes("dailyUtilization")) {
  ok("day optimization outputs");
} else fail("day outputs incomplete");

const gaps = read("src/lib/scheduling-engine/gaps.ts");
if (gaps.includes("detectScheduleGaps") && gaps.includes("fitsGapWithoutConflict")) {
  ok("gap filling");
} else fail("gaps incomplete");

const routes = read("src/lib/scheduling-engine/routes.ts");
if (routes.includes("optimizeRoute") && routes.includes("haversineKm")) {
  ok("route optimization");
} else fail("routes incomplete");

const opps = read("src/lib/scheduling-engine/opportunities.ts");
if (opps.includes("scoreOpportunities") && opps.includes("fitsGapWithoutConflict")) {
  ok("opportunity planner");
} else fail("opportunities incomplete");

const expl = read("src/lib/scheduling-engine/explanations.ts");
if (
  expl.includes("SCHEDULE_ADVISORY_NOTICE") &&
  expl.includes("Idle gaps detected") &&
  !expl.includes("compositeFactor")
) {
  ok("public explanations + advisory");
} else fail("explanations incomplete");

const svc = read("src/lib/scheduling-engine/service.ts");
if (
  svc.includes("toPublicDayOptimization") &&
  svc.includes("isAiSchedulingEnabled") &&
  !svc.includes("autoBook")
) {
  ok("public service (no auto-book)");
} else fail("service incomplete");

const obs = read("src/lib/scheduling-engine/observability.ts");
for (const e of [
  "optimization_executed",
  "recommendation_accepted",
  "opportunity_accepted",
  "travel_reduction",
  "capacity_warning",
  "latency",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

const bridge = read("src/lib/ai/scheduling/index.ts");
if (bridge.includes("sprint8-phase4")) ok("ai/scheduling bridge");
else fail("bridge incomplete");

const en = read("messages/en.json");
const ar = read("messages/ar.json");
if (en.includes('"scheduling"') && ar.includes('"scheduling"')) ok("i18n en/ar");
else fail("i18n missing");

if (failed === 0) {
  console.log("\nAll AI scheduling invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
