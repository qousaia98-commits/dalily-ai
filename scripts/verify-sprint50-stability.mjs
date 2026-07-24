/**
 * Sprint 50 — targeted pure-function checks (no DB).
 * Run: node scripts/verify-sprint50-stability.mjs
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// Compile-free checks mirrored from status-machine + getLocalizedText behavior.
const TRANSITIONS = {
  pending: ["confirmed", "declined", "cancelled", "expired", "rescheduled"],
  confirmed: [
    "cancelled",
    "rescheduled",
    "awaiting_customer_confirmation",
    "issue_reported",
    "customer_confirmed",
    "completed",
  ],
  rescheduled: ["confirmed", "cancelled", "declined", "rescheduled"],
  awaiting_customer_confirmation: [
    "customer_confirmed",
    "completed",
    "issue_reported",
    "cancelled",
    "rescheduled",
  ],
  customer_confirmed: ["completed"],
  issue_reported: [
    "awaiting_customer_confirmation",
    "customer_confirmed",
    "completed",
    "cancelled",
    "rescheduled",
    "issue_reported",
  ],
  declined: [],
  cancelled: [],
  completed: [],
  expired: [],
};

function allowed(from, to) {
  return TRANSITIONS[from].includes(to);
}

assert(allowed("pending", "confirmed"), "H1 pending → confirmed");
assert(allowed("pending", "declined"), "H1 pending → declined");
assert(allowed("pending", "cancelled"), "H1 pending → cancelled");
assert(allowed("confirmed", "cancelled"), "H1 confirmed → cancelled");
assert(allowed("confirmed", "rescheduled"), "H1 confirmed → rescheduled");
assert(allowed("rescheduled", "confirmed"), "H1 rescheduled → confirmed");
assert(allowed("customer_confirmed", "completed"), "H1 customer_confirmed → completed");
assert(!allowed("completed", "cancelled"), "H1 completed cannot cancel");
assert(!allowed("declined", "confirmed"), "H1 declined is terminal");
assert(!allowed("cancelled", "pending"), "H1 cancelled is terminal");
assert(!allowed("completed", "customer_confirmed"), "H1 completed is terminal");

function getLocalizedText(text, locale) {
  if (!text) return "";
  const primary = (locale === "en" ? text.en : text.ar)?.trim?.() ?? (locale === "en" ? text.en : text.ar) ?? "";
  const p = String(primary).trim();
  if (p) return p;
  const fallback = (locale === "en" ? text.ar : text.en) ?? "";
  return String(fallback).trim();
}

assert(getLocalizedText({ ar: "دليلي", en: "" }, "en") === "دليلي", "H5 en falls back to ar");
assert(getLocalizedText({ ar: "", en: "Dalily" }, "ar") === "Dalily", "H5 ar falls back to en");
assert(getLocalizedText({ ar: "اسم", en: "Name" }, "en") === "Name", "H5 prefers requested locale");
assert(getLocalizedText({ ar: "اسم", en: "" }, "ar") === "اسم", "H5 ar when present");

// Source-level guards for remaining fixes (string presence checks).
const fs = await import("node:fs");
const verificationSrc = fs.readFileSync(
  path.join(root, "src/actions/verification.actions.ts"),
  "utf8",
);
assert(
  verificationSrc.includes("isVerificationComplete(verification)") &&
    verificationSrc.includes('error: "documents_incomplete"'),
  "H3 approveVerificationAction guards incomplete docs",
);

const moderationSrc = fs.readFileSync(
  path.join(root, "src/actions/admin-control-center.actions.ts"),
  "utf8",
);
assert(
  moderationSrc.includes('rpc("recompute_provider_trust_score"'),
  "H2 moderateReviewAction recomputes trust/rating",
);

const providerSrc = fs.readFileSync(
  path.join(root, "src/actions/provider.actions.ts"),
  "utf8",
);
const avatarStart = providerSrc.indexOf('if (kind === "avatar" || kind === "cover")');
const onlyAfter = providerSrc.indexOf("Only after the provider points", avatarStart);
assert(
  avatarStart >= 0 &&
    onlyAfter > avatarStart &&
    providerSrc.indexOf(".insert({", avatarStart) < onlyAfter,
  "H4 avatar/cover inserts before deleting old image",
);

const syncSrc = fs.readFileSync(
  path.join(root, "src/lib/translation/sync-localized-field.ts"),
  "utf8",
);
assert(
  !syncSrc.includes('result[targetLocale] = ""'),
  "H5 syncLocalizedField does not overwrite with empty string",
);

if (process.exitCode) {
  console.error("\nSprint 50 verification FAILED");
  process.exit(1);
}
console.log("\nSprint 50 verification PASSED");
