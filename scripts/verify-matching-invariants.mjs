/**
 * Sprint 3 — structural invariants for Matching domain.
 * Ensures match path stays free of subscription / browse-ranking imports.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matchingDir = path.join(root, "src", "domains", "matching");

const required = [
  "index.ts",
  "policy.ts",
  "reasons.ts",
  "eligibility.ts",
  "rank.ts",
  "engine.ts",
  "queries.ts",
];

const missing = required.filter((f) => !existsSync(path.join(matchingDir, f)));
if (missing.length) {
  console.error("verify-matching FAILED — missing files:", missing.join(", "));
  process.exit(1);
}

const forbidden = [
  "@/lib/subscription",
  "lib/subscription",
  "dalily-ranking",
  "PlanSlug",
  "plan_slug",
  "SMART_MATCH_WEIGHTS",
];

const files = readdirSync(matchingDir).filter((f) => f.endsWith(".ts"));
const violations = [];

for (const file of files) {
  const text = readFileSync(path.join(matchingDir, file), "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      violations.push(`${file} contains forbidden "${needle}"`);
    }
  }
}

const policy = readFileSync(path.join(matchingDir, "policy.ts"), "utf8");
if (!policy.includes("subscriptionInfluence: false")) {
  violations.push("policy.ts must snapshot subscriptionInfluence: false");
}

const engine = readFileSync(path.join(matchingDir, "engine.ts"), "utf8");
if (!engine.includes("export async function expandMatchPool")) {
  violations.push("engine.ts must export expandMatchPool (testable expand-on-failure)");
}
if (!engine.includes("export async function runMatchingForRequest")) {
  violations.push("engine.ts must export runMatchingForRequest");
}

const migration = path.join(
  root,
  "supabase",
  "migrations",
  "20260725180000_sprint3_matching_engine.sql",
);
if (!existsSync(migration)) {
  violations.push("missing sprint3 matching migration");
}

if (violations.length) {
  console.error("verify-matching FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`verify-matching OK (${files.length} matching files checked)`);
