/**
 * Sprint 8 Phase 1 — AI Smart Matching Engine invariants.
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

console.log("══ Smart Matching Engine invariants ══\n");

const required = [
  "supabase/migrations/20260727130000_sprint8_ai_smart_matching.sql",
  "src/lib/matching-engine/types.ts",
  "src/lib/matching-engine/signals.ts",
  "src/lib/matching-engine/weights.ts",
  "src/lib/matching-engine/engine.ts",
  "src/lib/matching-engine/fairness.ts",
  "src/lib/matching-engine/explanations.ts",
  "src/lib/matching-engine/collect.ts",
  "src/lib/matching-engine/service.ts",
  "src/lib/matching-engine/admin.ts",
  "src/lib/matching-engine/preferences.ts",
  "src/lib/matching-engine/capacity.ts",
  "src/actions/matching.actions.ts",
  "src/app/[locale]/(admin)/admin/matching/page.tsx",
  "src/components/admin/admin-matching-center-panel.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/20260727130000_sprint8_ai_smart_matching.sql");
for (const t of [
  "matching_weights",
  "matching_scores",
  "matching_history",
  "matching_feedback",
  "matching_explanations",
  "customer_preferences",
  "provider_capacity",
  "matching_experiments",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const flags = read("src/lib/config/feature-flags.ts");
if (flags.includes("isSmartMatchingEngineEnabled")) ok("feature flag");
else fail("missing isSmartMatchingEngineEnabled");

const signals = read("src/lib/matching-engine/signals.ts");
for (const s of [
  "distance",
  "availability",
  "reputation",
  "fraud_risk",
  "favourite_providers",
  "fairness_exploration",
]) {
  if (signals.includes(`"${s}"`)) ok(`signal ${s}`);
  else fail(`missing signal ${s}`);
}

const engine = read("src/lib/matching-engine/engine.ts");
if (engine.includes("computeMatchFromSignals") && engine.includes("ML_RANKER_COLLECTOR")) {
  ok("modular engine + ML layer");
} else fail("engine incomplete");

const fairness = read("src/lib/matching-engine/fairness.ts");
if (
  fairness.includes("coldStart") ||
  fairness.includes("cold_start") ||
  fairness.includes("exploration")
) {
  ok("fairness model");
} else fail("fairness missing");

const expl = read("src/lib/matching-engine/explanations.ts");
if (expl.includes("Highly rated") && !expl.includes("internalScore")) {
  ok("public explanations without scores");
} else fail("explanations leak or incomplete");

const rank = read("src/lib/ai/matching/rank-with-ai.ts");
if (rank.includes("isSmartMatchingEngineEnabled") && rank.includes("rankProvidersSmartMatch")) {
  ok("wired into AI ranking");
} else fail("ranking integration missing");

const obs = read("src/lib/matching-engine/observability.ts");
for (const e of [
  "matching_calculated",
  "recommendation_accepted",
  "recommendation_ignored",
  "booking_completed",
  "latency",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

const pub = read("src/lib/matching-engine/service.ts");
if (pub.includes("toPublicRecommendations") && pub.includes("internalScore")) {
  ok("public/private score separation");
} else fail("public API incomplete");

if (failed === 0) {
  console.log("\nAll smart matching invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
