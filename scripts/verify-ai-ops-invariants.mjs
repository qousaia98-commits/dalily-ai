/**
 * Sprint 7 Phase 6 — AI Operations & Platform Health invariants.
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

console.log("══ AI Ops / Platform Health invariants ══\n");

const required = [
  "supabase/migrations/20260727120000_sprint7_ai_ops_platform_health.sql",
  "src/lib/ai-ops/types.ts",
  "src/lib/ai-ops/collect.ts",
  "src/lib/ai-ops/health.ts",
  "src/lib/ai-ops/trends.ts",
  "src/lib/ai-ops/anomalies.ts",
  "src/lib/ai-ops/alerts.ts",
  "src/lib/ai-ops/insights.ts",
  "src/lib/ai-ops/service.ts",
  "src/lib/ai-ops/queries.ts",
  "src/lib/ai-ops/observability.ts",
  "src/actions/ai-ops.actions.ts",
  "src/app/[locale]/(admin)/admin/ai-ops/page.tsx",
  "src/components/admin/admin-ai-ops-dashboard.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/20260727120000_sprint7_ai_ops_platform_health.sql");
for (const t of [
  "platform_health_metrics",
  "platform_anomalies",
  "platform_alerts",
  "platform_trends",
  "category_health",
  "region_health",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

if (mig.toLowerCase().includes("enable row level security")) ok("RLS present");
else fail("RLS missing");

const flags = read("src/lib/config/feature-flags.ts");
if (flags.includes("isAiOpsEnabled")) ok("feature flag");
else fail("missing isAiOpsEnabled");

const trends = read("src/lib/ai-ops/trends.ts");
for (const p of ["daily", "weekly", "monthly", "quarterly", "yearly"]) {
  if (trends.includes(`"${p}"`) || trends.includes(`'${p}'`) || trends.includes(p)) {
    ok(`trend period ${p}`);
  } else fail(`missing trend period ${p}`);
}

const anomalies = read("src/lib/ai-ops/anomalies.ts");
for (const a of [
  "refund_spike",
  "review_spike",
  "booking_drop",
  "complaint_spike",
  "fraud_spike",
  "payment_anomaly",
]) {
  if (anomalies.includes(a)) ok(`anomaly ${a}`);
  else fail(`missing anomaly ${a}`);
}

const obs = read("src/lib/ai-ops/observability.ts");
for (const e of [
  "alert_created",
  "alert_acknowledged",
  "trend_generated",
  "health_snapshot",
  "anomaly_detected",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

const page = read("src/app/[locale]/(admin)/admin/ai-ops/page.tsx");
if (page.includes("isAiOpsEnabled") && page.includes("requireAdminUser")) {
  ok("admin-gated page");
} else fail("admin page not gated");

const actions = read("src/actions/ai-ops.actions.ts");
if (
  actions.includes("acknowledgeAlert") &&
  actions.includes("exportOpsReportAction") &&
  actions.includes("createInvestigationFromOpsAction")
) {
  ok("action center wired");
} else fail("action center incomplete");

if (failed === 0) {
  console.log("\nAll AI Ops invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
