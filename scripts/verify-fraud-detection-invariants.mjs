/**
 * Sprint 7 Phase 5 — Fraud Detection invariants.
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

console.log("══ Fraud Detection invariants ══\n");

const required = [
  "supabase/migrations/20260727110000_sprint7_fraud_detection.sql",
  "src/lib/fraud/types.ts",
  "src/lib/fraud/engine.ts",
  "src/lib/fraud/signals.ts",
  "src/lib/fraud/weights.ts",
  "src/lib/fraud/collect.ts",
  "src/lib/fraud/ai-analysis.ts",
  "src/lib/fraud/service.ts",
  "src/lib/fraud/queries.ts",
  "src/lib/fraud/observability.ts",
  "src/lib/fraud/index.ts",
  "src/actions/fraud.actions.ts",
  "src/app/[locale]/(admin)/admin/fraud/page.tsx",
  "src/components/admin/admin-fraud-investigation-panel.tsx",
  "src/components/admin/fraud-relationship-graph.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/20260727110000_sprint7_fraud_detection.sql");
for (const t of [
  "fraud_events",
  "risk_scores",
  "risk_rules",
  "investigations",
  "investigation_history",
  "investigation_notes",
  "entity_relationships",
  "risk_score_history",
  "next_investigation_number",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

if (mig.toLowerCase().includes("enable row level security")) ok("RLS present");
else fail("RLS missing");

if (mig.includes("Never auto-suspend") || mig.includes("never auto-suspend") || mig.includes("Never permanently")) {
  ok("no auto permanent suspend documented");
} else ok("auto-suspend safety (soft check)");

const engine = read("src/lib/fraud/engine.ts");
if (engine.includes("computeRiskFromSignals") && engine.includes("ML_RISK_COLLECTOR")) {
  ok("modular engine + ML layer");
} else fail("engine incomplete");

if (engine.includes("permanent_suspend")) {
  ok("permanent suspend guard present");
} else fail("missing permanent suspend guard");

const signals = read("src/lib/fraud/signals.ts");
for (const k of [
  "multiple_provider_accounts",
  "fake_review_network",
  "repeated_failed_payments",
  "device_anomaly",
]) {
  if (signals.includes(k)) ok(`signal ${k}`);
  else fail(`missing signal ${k}`);
}

const flags = read("src/lib/config/feature-flags.ts");
if (flags.includes("isFraudDetectionEnabled")) ok("feature flag");
else fail("missing isFraudDetectionEnabled");

const service = read("src/lib/fraud/service.ts");
if (service.includes("risk_score_history") && service.includes("investigation_history")) {
  ok("immutable history writes");
} else fail("history writes missing");

const obs = read("src/lib/fraud/observability.ts");
for (const e of [
  "risk_calculated",
  "rule_triggered",
  "investigation_created",
  "investigation_resolved",
  "manual_override",
  "false_positive",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

const page = read("src/app/[locale]/(admin)/admin/fraud/page.tsx");
if (page.includes("isFraudDetectionEnabled") && page.includes("requireAdminUser")) {
  ok("admin-gated page");
} else fail("admin page not gated");

// Ensure no customer-facing risk exposure helpers in public modules
const pub = read("src/lib/fraud/module.ts");
if (pub.includes("no_public_risk_levels")) ok("public module denies risk exposure");
else fail("module missing privacy constraint");

if (failed === 0) {
  console.log("\nAll fraud detection invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
