import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 8 Phase 2 — AI Dynamic Pricing & Market Intelligence invariants.
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

console.log("══ Dynamic Pricing invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727140000_sprint8_ai_dynamic_pricing.sql",
  "src/lib/pricing-engine/types.ts",
  "src/lib/pricing-engine/signals.ts",
  "src/lib/pricing-engine/weights.ts",
  "src/lib/pricing-engine/engine.ts",
  "src/lib/pricing-engine/explanations.ts",
  "src/lib/pricing-engine/collect.ts",
  "src/lib/pricing-engine/service.ts",
  "src/lib/pricing-engine/admin.ts",
  "src/lib/pricing-engine/market.ts",
  "src/lib/pricing-engine/observability.ts",
  "src/lib/pricing-engine/index.ts",
  "src/actions/pricing.actions.ts",
  "src/app/[locale]/(admin)/admin/pricing/page.tsx",
  "src/components/admin/admin-pricing-center-panel.tsx",
  "src/app/[locale]/(business)/business/pricing/page.tsx",
  "src/components/pricing/provider-pricing-insights-panel.tsx",
  "src/components/pricing/customer-fair-market-estimate.tsx",
  "src/app/[locale]/(public)/account/pricing/page.tsx",
  "src/lib/ai/pricing/index.ts",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read(
  "supabase/migrations/archive/20260727140000_sprint8_ai_dynamic_pricing.sql",
);
for (const t of [
  "pricing_weights",
  "pricing_history",
  "pricing_feedback",
  "pricing_market_data",
  "pricing_explanations",
  "pricing_experiments",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isAiDynamicPricingEnabled")) ok("feature flag");
else fail("missing isAiDynamicPricingEnabled");

const signals = read("src/lib/pricing-engine/signals.ts");
for (const s of [
  "service_category",
  "region",
  "travel_distance",
  "urgency",
  "market_demand",
  "provider_reputation",
  "weather",
  "holiday_calendar",
  "repeat_customer",
  "large_project",
  "ml_pricing",
]) {
  if (signals.includes(`"${s}"`)) ok(`signal ${s}`);
  else fail(`missing signal ${s}`);
}

const engine = read("src/lib/pricing-engine/engine.ts");
if (
  engine.includes("computePriceFromSignals") &&
  engine.includes("ML_PRICING_COLLECTOR") &&
  engine.includes("suggestedMin") &&
  engine.includes("suggestedPremium")
) {
  ok("modular engine + ML layer + range output");
} else fail("engine incomplete");

const expl = read("src/lib/pricing-engine/explanations.ts");
if (
  expl.includes("High demand today") &&
  expl.includes("Weekend surcharge") &&
  !expl.includes("compositeFactor")
) {
  ok("public explanations without internal math");
} else fail("explanations leak or incomplete");

const svc = read("src/lib/pricing-engine/service.ts");
if (
  svc.includes("toPublicPriceRecommendation") &&
  svc.includes("recommendPrice") &&
  !svc.includes("forcePrice")
) {
  ok("public recommendation API (no forced prices)");
} else fail("public API incomplete");

if (svc.includes("isAiDynamicPricingEnabled")) {
  ok("flag-gated recommendPrice");
} else fail("service gating incomplete");

const aiPricing = read("src/lib/ai/pricing/index.ts");
if (
  aiPricing.includes("getFairMarketEstimate") &&
  aiPricing.includes("sprint8-phase2")
) {
  ok("ai/pricing bridge");
} else fail("ai/pricing stub not updated");

const obs = read("src/lib/pricing-engine/observability.ts");
for (const e of [
  "pricing_calculated",
  "recommendation_shown",
  "provider_price_set",
  "offer_accepted",
  "latency",
]) {
  if (obs.includes(e)) ok(`event ${e}`);
  else fail(`observability missing ${e}`);
}

const jobs = read("src/lib/ai/jobs/service.ts");
if (jobs.includes("isAiDynamicPricingEnabled") && jobs.includes("recommendPrice")) {
  ok("job prep price enrichment");
} else fail("job prep not wired");

const offers = read("src/domains/offer/create-offer.ts");
if (offers.includes("recordPricingFeedback")) ok("offer feedback wired");
else fail("offer feedback missing");

const en = read("messages/en.json");
const ar = read("messages/ar.json");
if (en.includes('"pricing"') && ar.includes('"pricing"')) ok("i18n en/ar pricing keys");
else fail("i18n missing");

if (failed === 0) {
  console.log("\nAll dynamic pricing invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
