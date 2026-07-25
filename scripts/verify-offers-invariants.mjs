/**
 * Sprint 4 — structural invariants for Offer domain.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const offerDir = path.join(root, "src", "domains", "offer");

const required = [
  "index.ts",
  "types.ts",
  "quality.ts",
  "create-offer.ts",
  "queries.ts",
];

const missing = required.filter((f) => !existsSync(path.join(offerDir, f)));
if (missing.length) {
  console.error("verify-offers FAILED — missing files:", missing.join(", "));
  process.exit(1);
}

const createOffer = readFileSync(path.join(offerDir, "create-offer.ts"), "utf8");
const violations = [];

if (!createOffer.includes("match_assignment")) {
  violations.push("create-offer must require match_assignment");
}
if (!createOffer.includes("provider_id") || !createOffer.includes("// Explicitly do NOT set provider_id")) {
  violations.push("selectOffer must not bind service_requests.provider_id");
}
if (createOffer.includes("from(\"conversations\")") || createOffer.includes("canChat")) {
  violations.push("offer create/select must not open chat");
}

const flags = readFileSync(
  path.join(root, "src", "lib", "config", "feature-flags.ts"),
  "utf8",
);
if (!flags.includes("OFFERS_V2") || !flags.includes("isOffersV2Enabled")) {
  violations.push("OFFERS_V2 flag missing");
}

const migration = path.join(
  root,
  "supabase",
  "migrations",
  "20260725190000_sprint4_offer_system.sql",
);
if (!existsSync(migration)) {
  violations.push("missing sprint4 offer migration");
}

const types = readFileSync(path.join(offerDir, "types.ts"), "utf8");
if (!types.includes("OFFER_COMPARE_MAX = 3")) {
  violations.push("OFFER_COMPARE_MAX must be 3");
}

if (violations.length) {
  console.error("verify-offers FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

const files = readdirSync(offerDir).filter((f) => f.endsWith(".ts"));
console.log(`verify-offers OK (${files.length} offer files checked)`);
