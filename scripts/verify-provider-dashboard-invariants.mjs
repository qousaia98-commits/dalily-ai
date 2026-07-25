/**
 * Sprint 8 — structural invariants for Provider Dashboard Migration.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

const flags = readFileSync(
  path.join(root, "src", "lib", "config", "feature-flags.ts"),
  "utf8",
);
if (!flags.includes("PROVIDER_DASHBOARD_V2") || !flags.includes("isProviderDashboardV2Enabled")) {
  violations.push("PROVIDER_DASHBOARD_V2 flag missing");
}

const dash = path.join(root, "src", "domains", "provider", "dashboard.ts");
if (!existsSync(dash)) {
  violations.push("missing provider dashboard aggregate");
} else {
  const src = readFileSync(dash, "utf8");
  if (!src.includes("listProviderUnlockSessions")) {
    violations.push("dashboard must reuse unlock listProviderUnlockSessions");
  }
  if (!src.includes("listProviderOpportunities")) {
    violations.push("dashboard must reuse offer listProviderOpportunities");
  }
  if (!src.includes("getProviderRequestSettings")) {
    violations.push("dashboard must read pause/settings from authoritative query");
  }
  // Must not invent unlock/payment capture logic
  if (src.includes("completeUnlockSuccess") || src.includes("captureUnlockFeePayment")) {
    violations.push("dashboard must not reimplement unlock/payment capture");
  }
}

const page = readFileSync(
  path.join(root, "src", "app", "[locale]", "(business)", "business", "page.tsx"),
  "utf8",
);
if (!page.includes("isProviderDashboardV2Enabled") || !page.includes("ProviderDashboardHomeView")) {
  violations.push("business home must gate Sprint 8 dashboard behind flag");
}
if (!page.includes("ProviderSuccessDashboardView")) {
  violations.push("legacy success dashboard must remain when flag off");
}

const opp = readFileSync(
  path.join(root, "src", "domains", "offer", "queries.ts"),
  "utf8",
);
if (!opp.includes("reason_codes") || !opp.includes("reasons")) {
  violations.push("opportunities must expose why-matched reason_codes");
}

const eligibility = readFileSync(
  path.join(root, "src", "domains", "matching", "eligibility.ts"),
  "utf8",
);
if (!eligibility.includes("handles_emergency") || !eligibility.includes("vacation")) {
  violations.push("matching eligibility must honor pause + emergency honesty");
}

const migrations = readdirSync(path.join(root, "supabase", "migrations"));
const sprint8 = migrations.find((f) => f.includes("sprint8_provider_dashboard"));
if (!sprint8) {
  violations.push("missing sprint8 provider dashboard migration");
} else {
  const sql = readFileSync(path.join(root, "supabase", "migrations", sprint8), "utf8");
  if (!sql.includes("handles_emergency")) {
    violations.push("migration must add handles_emergency");
  }
}

const notes = path.join(root, "docs", "migration", "sprint-8-notes.md");
if (!existsSync(notes)) {
  violations.push("missing sprint-8-notes.md (incl. mobile P0 notification docs)");
} else {
  const n = readFileSync(notes, "utf8");
  if (!n.includes("P0") || !n.includes("mobile")) {
    violations.push("sprint-8 notes must document mobile-first P0 notifications");
  }
}

if (violations.length) {
  console.error("verify-provider-dashboard FAILED:");
  for (const v of violations) console.error(" -", v);
  process.exit(1);
}

console.log("verify-provider-dashboard OK");
