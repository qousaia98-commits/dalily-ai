import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 7 Phase 4 — Quality Assurance & Case Management invariants.
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

console.log("══ Quality Cases invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727100000_sprint7_quality_cases.sql",
  "src/lib/quality/types.ts",
  "src/lib/quality/service.ts",
  "src/lib/quality/ai-analysis.ts",
  "src/lib/quality/metrics.ts",
  "src/lib/quality/queries.ts",
  "src/lib/quality/observability.ts",
  "src/lib/quality/map.ts",
  "src/lib/quality/index.ts",
  "src/actions/quality.actions.ts",
  "src/app/[locale]/(admin)/admin/quality/page.tsx",
  "src/app/[locale]/(public)/account/quality/page.tsx",
  "src/app/[locale]/(business)/business/quality/page.tsx",
  "src/components/admin/admin-quality-cases-panel.tsx",
  "src/components/quality/customer-quality-cases-panel.tsx",
  "src/components/quality/provider-quality-insights-panel.tsx",
  "src/components/quality/quality-case-create-form.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727100000_sprint7_quality_cases.sql");
for (const t of [
  "quality_cases",
  "quality_case_messages",
  "quality_case_evidence",
  "quality_case_history",
  "quality_case_assignments",
  "quality_case_ai_analysis",
  "quality_case_metrics",
  "next_quality_case_number",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

if (mig.includes("ENABLE ROW LEVEL SECURITY") || mig.includes("ENABLE ROW LEVEL SECURITY".toLowerCase()) || mig.includes("row level security")) {
  ok("RLS present");
} else if (mig.toLowerCase().includes("enable row level security")) {
  ok("RLS present");
} else {
  fail("RLS missing");
}

const types = read("src/lib/quality/types.ts");
for (const s of [
  "open",
  "pending_information",
  "under_review",
  "waiting_for_provider",
  "waiting_for_customer",
  "resolved",
  "rejected",
  "escalated",
  "closed",
]) {
  if (types.includes(`"${s}"`)) ok(`status ${s}`);
  else fail(`missing status ${s}`);
}

for (const c of [
  "customer_complaint",
  "provider_complaint",
  "booking_issue",
  "service_quality",
  "communication",
  "damage_report",
  "late_arrival",
  "no_show",
  "policy_violation",
  "other",
]) {
  if (types.includes(`"${c}"`)) ok(`category ${c}`);
  else fail(`missing category ${c}`);
}

const service = read("src/lib/quality/service.ts");
if (service.includes("appendHistory") && service.includes("quality_case_history")) {
  ok("immutable history writes");
} else fail("history append missing");

if (service.includes("analyzeQualityCase") && service.includes("quality_case_ai_analysis")) {
  ok("AI analysis on create");
} else fail("AI analysis wiring missing");

const ai = read("src/lib/quality/ai-analysis.ts");
for (const k of ["sentiment", "severity", "urgency", "riskLevel", "suggestedCategory", "suggestedPriority", "suggestedResolution"]) {
  if (ai.includes(k)) ok(`AI field ${k}`);
  else fail(`AI missing ${k}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isQualityCasesEnabled")) ok("feature flag");
else fail("missing isQualityCasesEnabled");

const bridge = read("src/lib/booking/completion-service.ts");
if (bridge.includes("createCaseFromBookingIssue")) ok("booking issue bridge");
else fail("booking issue bridge missing");

const obs = read("src/lib/quality/observability.ts");
for (const e of [
  "case_created",
  "evidence_uploaded",
  "status_changed",
  "case_assigned",
  "case_escalated",
  "case_resolved",
  "ai_analysis_completed",
]) {
  if (obs.includes(e) || obs.toUpperCase().includes(e.toUpperCase())) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

if (failed === 0) {
  console.log("\nAll quality case invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
