import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 6 Phase 6 — finance analytics invariants (static checks).
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

console.log("══ Finance analytics invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727060000_sprint6_finance_analytics.sql",
  "src/lib/finance-analytics/snapshot.ts",
  "src/lib/finance-analytics/types.ts",
  "src/actions/finance-analytics.actions.ts",
  "src/components/admin/admin-finance-dashboard.tsx",
  "src/components/admin/finance-charts.tsx",
  "src/app/[locale]/(admin)/admin/finance/page.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727060000_sprint6_finance_analytics.sql");
for (const t of [
  "finance_paid_payments_v",
  "finance_daily_revenue_v",
  "finance_monthly_revenue_v",
  "finance_analytics_cache",
  "payments_paid_at_idx",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}
if (mig.includes("CREATE TABLE") && mig.includes("payments") && !mig.includes("CREATE TABLE public.payments")) {
  ok("does not recreate payments table");
}

const snap = read("src/lib/finance-analytics/snapshot.ts");
for (const k of ["mrr", "arr", "arpp", "conversionRate", "churnRate", "financeReportToCsv", "financeReportToPdf"]) {
  if (snap.includes(k)) ok(`snapshot has ${k}`);
  else fail(`snapshot missing ${k}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isFinanceDashboardEnabled")) ok("feature flag");
else fail("missing isFinanceDashboardEnabled");

const actions = read("src/actions/finance-analytics.actions.ts");
if (actions.includes("requireAdminUser") && actions.includes("isPlatformAdmin")) {
  ok("admin-only gate");
} else fail("admin gate missing");
if (actions.includes("logAdminAction") && actions.includes("finance_report_exported")) {
  ok("export audit");
} else fail("export audit missing");

const ui = read("src/components/admin/admin-finance-dashboard.tsx");
if (ui.includes("exportCsv") && ui.includes("exportPdf")) ok("CSV + PDF export UI");
else fail("export UI missing");

const charts = read("src/components/admin/finance-charts.tsx");
if (charts.includes("dailyRevenue") && charts.includes("mrrTrend")) ok("chart grid");
else fail("charts incomplete");

console.log("");
if (failed) {
  console.error(`FAILED: ${failed}`);
  process.exit(1);
}
console.log("All finance analytics invariants passed.");
