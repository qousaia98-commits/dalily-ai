/**
 * Sprint 8 Phase 6 — AI Marketplace Intelligence Platform invariants.
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

console.log("══ AI Marketplace Intelligence invariants ══\n");

const required = [
  "supabase/migrations/20260727180000_sprint8_ai_marketplace_intelligence.sql",
  "src/lib/marketplace-intelligence/types.ts",
  "src/lib/marketplace-intelligence/modules.ts",
  "src/lib/marketplace-intelligence/collect.ts",
  "src/lib/marketplace-intelligence/category-regional.ts",
  "src/lib/marketplace-intelligence/engines.ts",
  "src/lib/marketplace-intelligence/simulation.ts",
  "src/lib/marketplace-intelligence/service.ts",
  "src/lib/marketplace-intelligence/admin.ts",
  "src/lib/marketplace-intelligence/observability.ts",
  "src/lib/marketplace-intelligence/index.ts",
  "src/actions/marketplace-intelligence.actions.ts",
  "src/app/[locale]/(admin)/admin/marketplace-intelligence/page.tsx",
  "src/components/admin/admin-marketplace-intelligence-panel.tsx",
  "src/lib/ai/marketplace-intelligence/index.ts",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read(
  "supabase/migrations/20260727180000_sprint8_ai_marketplace_intelligence.sql",
);
for (const t of [
  "marketplace_intelligence",
  "marketplace_reports",
  "marketplace_recommendations",
  "marketplace_opportunities",
  "marketplace_simulations",
  "marketplace_decisions",
  "marketplace_knowledge_graph",
  "marketplace_heatmaps",
  "marketplace_category_metrics",
  "marketplace_region_metrics",
  "marketplace_executive_reports",
  "marketplace_algorithm_versions",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

if (mig.includes("affects_production = false")) ok("simulations production isolation");
else fail("missing simulation isolation constraint");

if (mig.includes("internal_only")) ok("knowledge graph internal");
else fail("kg not internal");

const flags = read("src/lib/config/feature-flags.ts");
if (flags.includes("isAiMarketplaceIntelligenceEnabled")) ok("feature flag");
else fail("missing flag");

const modules = read("src/lib/marketplace-intelligence/modules.ts");
if (
  modules.includes("rule") &&
  modules.includes("ml") &&
  modules.includes("simulation") &&
  modules.includes("agent") &&
  modules.includes("isModuleEnabled")
) {
  ok("modular engine registry");
} else fail("modules incomplete");

const engines = read("src/lib/marketplace-intelligence/engines.ts");
if (
  engines.includes("generateOpportunities") &&
  engines.includes("generateStrategicRecommendations") &&
  engines.includes("generateExecutiveReport") &&
  engines.includes("Launch") &&
  engines.includes("estimatedRoi")
) {
  ok("opportunity + decision + reports");
} else fail("engines incomplete");

const sim = read("src/lib/marketplace-intelligence/simulation.ts");
if (
  sim.includes("affectsProduction: false") &&
  sim.includes("FUTURE_AI_AGENTS") &&
  sim.includes("mayActIrreversibly: false")
) {
  ok("digital twin + agent architecture");
} else fail("simulation/agents incomplete");

const svc = read("src/lib/marketplace-intelligence/service.ts");
if (
  svc.includes("getMarketplaceIntelligencePlatform") &&
  svc.includes("executeMarketplaceSimulation") &&
  svc.includes("isAiMarketplaceIntelligenceEnabled")
) {
  ok("service API");
} else fail("service incomplete");

const obs = read("src/lib/marketplace-intelligence/observability.ts");
for (const e of [
  "insight_generated",
  "report_generated",
  "simulation_executed",
  "recommendation_accepted",
  "recommendation_dismissed",
  "algorithm_version",
  "prediction_accuracy",
  "system_latency",
  "cache_performance",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`missing event ${e}`);
}

const bridge = read("src/lib/ai/marketplace-intelligence/index.ts");
if (bridge.includes("sprint8-phase6")) ok("ai bridge");
else fail("bridge missing phase6");

const en = read("messages/en.json");
const ar = read("messages/ar.json");
if (en.includes("marketplaceIntelligence") && ar.includes("marketplaceIntelligence")) {
  ok("i18n en/ar");
} else fail("i18n missing");

if (failed) {
  console.error(`\n${failed} invariant(s) failed.`);
  process.exit(1);
}
console.log("\nAll AI marketplace intelligence invariants passed.");
