import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 7 Phase 3 — AI Reputation Engine invariants.
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

console.log("══ AI Reputation Engine invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727090000_sprint7_ai_reputation_engine.sql",
  "src/lib/reputation/engine.ts",
  "src/lib/reputation/signals.ts",
  "src/lib/reputation/weights.ts",
  "src/lib/reputation/levels.ts",
  "src/lib/reputation/explanations.ts",
  "src/lib/reputation/collect.ts",
  "src/lib/reputation/service.ts",
  "src/lib/reputation/public.ts",
  "src/lib/reputation/insights.ts",
  "src/lib/reputation/admin.ts",
  "src/app/[locale]/(admin)/admin/reputation/page.tsx",
  "src/components/admin/admin-reputation-dashboard.tsx",
  "src/components/reviews/public-trust-panel.tsx",
  "src/components/provider-success/reputation-insights-panel.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727090000_sprint7_ai_reputation_engine.sql");
for (const t of [
  "provider_reputation_scores",
  "provider_reputation_history",
  "provider_reputation_signals",
  "provider_reputation_events",
  "provider_reputation_weights",
  "provider_reputation_explanations",
  "provider_public_trust",
  "needs_attention",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const engine = read("src/lib/reputation/engine.ts");
if (engine.includes("computeReputationFromSignals") && engine.includes("weight")) {
  ok("modular weighted engine");
} else fail("engine incomplete");

const levels = read("src/lib/reputation/levels.ts");
for (const l of ["excellent", "very_good", "good", "developing", "new_provider", "needs_attention"]) {
  if (levels.includes(l)) ok(`level ${l}`);
  else fail(`missing level ${l}`);
}

const pub = read("src/lib/reputation/public.ts");
if (pub.includes("internalScore") || pub.includes("internal_score")) {
  fail("public module must not expose internal scores");
} else ok("public view has no internal score");

const flags = readFeatureFlagsSource();
if (flags.includes("isAiReputationEngineEnabled")) ok("feature flag");
else fail("missing isAiReputationEngineEnabled");

const search = read("src/lib/search/search-engine.ts");
if (search.includes("reputationBoostByProviderId") || search.includes("fetchReputationSearchBoosts")) {
  ok("search integration");
} else fail("search missing reputation boost");

const match = read("src/lib/ai/matching/score.ts");
if (match.includes("reputation")) ok("AI match reputation factor");
else fail("AI match missing reputation");

if (failed === 0) {
  console.log("\nAll AI reputation engine invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
