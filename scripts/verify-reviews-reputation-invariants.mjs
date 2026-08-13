import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 7 Phase 2 — Ratings, Reviews & AI Reputation invariants.
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

console.log("══ Reviews & AI Reputation invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727080000_sprint7_reviews_reputation.sql",
  "src/lib/reviews/eligibility.ts",
  "src/lib/reviews/dimensions.ts",
  "src/lib/reviews/ai-analysis.ts",
  "src/lib/reviews/service.ts",
  "src/lib/reviews/observability.ts",
  "src/lib/reviews/trust-score.ts",
  "src/lib/reviews/queries.ts",
  "src/lib/admin/review-moderation.ts",
  "src/components/reviews/rating-breakdown.tsx",
  "src/components/admin/admin-review-moderation.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727080000_sprint7_reviews_reputation.sql");
for (const t of [
  "provider_reviews",
  "review_ratings",
  "review_media",
  "review_responses",
  "review_ai_analysis",
  "review_flags",
  "review_moderation",
  "review_helpfulness",
  "provider_reputation_cache",
  "review_settings",
  "editable_until",
  "recompute_provider_trust_score",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const dims = ["communication", "quality", "punctuality", "professionalism", "value"];
for (const d of dims) {
  if (mig.includes(`'${d}'`)) ok(`dimension ${d}`);
  else fail(`missing dimension ${d}`);
}

const ai = read("src/lib/reviews/ai-analysis.ts");
for (const fn of ["analyzeReviewText", "persistAiAnalysis", "enrichWithDuplicateSignals"]) {
  if (ai.includes(`export function ${fn}`) || ai.includes(`export async function ${fn}`)) {
    ok(fn);
  } else fail(`missing ${fn}`);
}

const svc = read("src/lib/reviews/service.ts");
for (const fn of [
  "submitVerifiedReview",
  "editReview",
  "requestReviewDelete",
  "syncProviderResponse",
  "uploadReviewMedia",
]) {
  if (svc.includes(`export async function ${fn}`)) ok(fn);
  else fail(`missing ${fn}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isReviewsReputationV2Enabled")) ok("feature flag");
else fail("missing isReviewsReputationV2Enabled");

const trust = read("src/lib/reviews/trust-score.ts");
if (trust.includes("recommendationRate") && trust.includes("recentRatingAvg")) {
  ok("trust score recency + recommendation");
} else fail("trust score missing new factors");

const elig = read("src/lib/reviews/eligibility.ts");
if (elig.includes("already_reviewed") && elig.includes("payment_pending")) {
  ok("eligibility gates");
} else fail("eligibility incomplete");

if (failed === 0) {
  console.log("\nAll reviews reputation invariants passed.");
  process.exit(0);
}
console.error(`\n${failed} invariant(s) failed.`);
process.exit(1);
