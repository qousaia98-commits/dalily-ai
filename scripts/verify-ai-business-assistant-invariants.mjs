/**
 * Sprint 8 Phase 5 — AI Business Assistant invariants.
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

console.log("══ AI Business Assistant invariants ══\n");

const required = [
  "supabase/migrations/20260727170000_sprint8_ai_business_assistant.sql",
  "src/lib/business-assistant/types.ts",
  "src/lib/business-assistant/collect.ts",
  "src/lib/business-assistant/insights.ts",
  "src/lib/business-assistant/benchmarks.ts",
  "src/lib/business-assistant/service.ts",
  "src/lib/business-assistant/admin.ts",
  "src/lib/business-assistant/observability.ts",
  "src/lib/business-assistant/index.ts",
  "src/actions/business-assistant.actions.ts",
  "src/app/[locale]/(admin)/admin/business-assistant/page.tsx",
  "src/components/admin/admin-business-assistant-panel.tsx",
  "src/app/[locale]/(business)/business/assistant/page.tsx",
  "src/components/business-assistant/provider-business-assistant-panel.tsx",
  "src/lib/ai/business-assistant/index.ts",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read(
  "supabase/migrations/20260727170000_sprint8_ai_business_assistant.sql",
);
for (const t of [
  "business_insights",
  "business_goals",
  "business_goal_progress",
  "business_benchmarks",
  "business_health",
  "business_recommendations",
  "business_briefings",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const flags = read("src/lib/config/feature-flags.ts");
if (flags.includes("isAiBusinessAssistantEnabled")) ok("feature flag");
else fail("missing flag");

const insights = read("src/lib/business-assistant/insights.ts");
if (
  insights.includes("generateMorningBriefing") &&
  insights.includes("Your response time improved") &&
  insights.includes("Accept more evening bookings")
) {
  ok("insights + briefing + recommendations");
} else fail("generators incomplete");

const bench = read("src/lib/business-assistant/benchmarks.ts");
if (bench.includes("top_20") && !bench.includes("competitorName")) {
  ok("anonymous benchmarks");
} else fail("benchmarks incomplete");

const svc = read("src/lib/business-assistant/service.ts");
if (
  svc.includes("getProviderBusinessAssistant") &&
  svc.includes("upsertBusinessGoal") &&
  svc.includes("isAiBusinessAssistantEnabled")
) {
  ok("service API");
} else fail("service incomplete");

const obs = read("src/lib/business-assistant/observability.ts");
for (const e of [
  "insight_generated",
  "goal_achieved",
  "recommendation_accepted",
  "business_health_updated",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`missing event ${e}`);
}

const rls = mig.includes("provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())");
if (rls) ok("RLS own-data isolation");
else fail("RLS missing");

const bridge = read("src/lib/ai/business-assistant/index.ts");
if (bridge.includes("sprint8-phase5")) ok("ai bridge");
else fail("bridge incomplete");

const en = read("messages/en.json");
const ar = read("messages/ar.json");
if (en.includes("businessAssistant") && ar.includes("businessAssistant")) {
  ok("i18n en/ar");
} else fail("i18n missing");

if (failed === 0) {
  console.log("\nAll AI business assistant invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
