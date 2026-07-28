import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";
/**
 * Sprint 6 Phase 5 — refunds & disputes invariants (static checks).
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

console.log("══ Refunds & disputes invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727050000_sprint6_refunds_disputes.sql",
  "src/lib/refunds/service.ts",
  "src/lib/refunds/disputes.ts",
  "src/lib/refunds/types.ts",
  "src/lib/financial-documents/credit-note.ts",
  "src/actions/refund.actions.ts",
  "src/components/admin/admin-refunds-panel.tsx",
  "src/components/business/provider-refunds-panel.tsx",
  "src/app/[locale]/(admin)/admin/refunds/page.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727050000_sprint6_refunds_disputes.sql");
for (const t of [
  "refund_requests",
  "refund_history",
  "payment_disputes",
  "dispute_evidence",
  "credit_note_metadata",
  "refunded_amount",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const statuses = [
  "requested",
  "pending",
  "approved",
  "rejected",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
];
for (const s of statuses) {
  if (mig.includes(`'${s}'`)) ok(`refund status ${s}`);
  else fail(`missing refund status ${s}`);
}

const svc = read("src/lib/refunds/service.ts");
for (const fn of [
  "requestRefund",
  "approveRefund",
  "rejectRefund",
  "completeRefundSuccess",
]) {
  if (svc.includes(`export async function ${fn}`)) ok(fn);
  else fail(`missing ${fn}`);
}
if (svc.includes("idempotencyKey") || svc.includes("refund:")) {
  ok("Stripe refund idempotency");
} else fail("missing Stripe refund idempotency");
if (svc.includes("generateCreditNoteForRefund")) {
  ok("credit note on success");
} else fail("credit note not wired");
if (svc.includes("paid → failed") || svc.includes("Do not rewrite paid")) {
  ok("paid status preserved (comment)");
}

const wh = read("src/lib/payment/stripe/webhooks.ts");
for (const e of [
  "charge.refunded",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]) {
  if (wh.includes(e)) ok(`webhook ${e}`);
  else fail(`missing webhook ${e}`);
}

const flags = readFeatureFlagsSource();
if (flags.includes("isRefundsDisputesEnabled")) ok("feature flag");
else fail("missing isRefundsDisputesEnabled");

const actions = read("src/actions/refund.actions.ts");
if (actions.includes("requireAdminUser") && actions.includes("approveRefund")) {
  ok("admin-only approve path");
} else fail("admin approve not gated");
if (actions.includes("requestRefund") && actions.includes("getOwnedProvider")) {
  ok("provider request ownership check");
} else fail("provider ownership missing");

const credit = read("src/lib/financial-documents/credit-note.ts");
if (credit.includes('allocateDocumentNumber("CRN")') || credit.includes("CRN")) {
  ok("CRN numbering");
} else fail("CRN numbering missing");

console.log("");
if (failed) {
  console.error(`FAILED: ${failed}`);
  process.exit(1);
}
console.log("All refunds & disputes invariants passed.");
