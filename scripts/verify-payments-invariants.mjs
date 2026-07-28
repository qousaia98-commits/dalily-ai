/**
 * Sprint 6 — structural invariants for Unlock Fee Payment Integration.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paymentDir = path.join(root, "src", "domains", "payment");

const required = [
  "index.ts",
  "unlock-fee.ts",
  "capture.ts",
  "webhook.ts",
  "webhook-ledger.ts",
];

const missing = required.filter((f) => !existsSync(path.join(paymentDir, f)));
if (missing.length) {
  console.error("verify-payments FAILED — missing files:", missing.join(", "));
  process.exit(1);
}

const capture = readFileSync(path.join(paymentDir, "capture.ts"), "utf8");
const unlockFee = readFileSync(path.join(paymentDir, "unlock-fee.ts"), "utf8");
const webhook = readFileSync(path.join(paymentDir, "webhook.ts"), "utf8");
const session = readFileSync(
  path.join(root, "src", "domains", "unlock", "session.ts"),
  "utf8",
);
const flags = readFeatureFlagsSource();
const adminActions = readFileSync(
  path.join(root, "src", "actions", "admin-payment.actions.ts"),
  "utf8",
);
const violations = [];

if (!flags.includes("UNLOCK_PAYMENTS_V2") || !flags.includes("isUnlockPaymentsV2Enabled")) {
  violations.push("UNLOCK_PAYMENTS_V2 flag missing");
}
if (!capture.includes("completeUnlockSuccess") || !capture.includes("payment_capture")) {
  violations.push("capture must correlate paid unlock_fee to grant via payment_capture");
}
if (!unlockFee.includes('purpose: "unlock_fee"')) {
  violations.push("unlock fee create must set purpose unlock_fee");
}
if (!webhook.includes("verifyWebhookSecret") || !webhook.includes("duplicate")) {
  violations.push("webhook must verify secret and be idempotent");
}
if (!session.includes("payment_not_confirmed") || !session.includes("payment_capture")) {
  violations.push("unlock success must require confirmed paid payment for payment_capture");
}
if (!adminActions.includes("captureUnlockFeePayment")) {
  violations.push("admin approve must branch unlock_fee to captureUnlockFeePayment");
}
if (adminActions.includes("activateAfterPayment") && !adminActions.includes('purpose === "unlock_fee"')) {
  violations.push("admin approve must not activate subscription for unlock_fee");
}

const migration = path.join(
  root,
  "supabase",
  "migrations",
  "archive",
  "20260725220000_sprint6_unlock_payments.sql",
);
if (!existsSync(migration)) {
  violations.push("missing sprint6 unlock payments migration");
}

const webhookRoute = path.join(
  root,
  "src",
  "app",
  "api",
  "webhooks",
  "payments",
  "[provider]",
  "route.ts",
);
if (!existsSync(webhookRoute)) {
  violations.push("missing payment webhook route");
}

const subActions = readFileSync(
  path.join(root, "src", "actions", "subscription.actions.ts"),
  "utf8",
);
if (!subActions.includes("subscription_upgrades_frozen")) {
  violations.push("subscription upgrades must freeze when UNLOCK_PAYMENTS_V2 on");
}

if (violations.length) {
  console.error("verify-payments FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

const files = readdirSync(paymentDir).filter((f) => f.endsWith(".ts"));
console.log(`verify-payments OK (${files.length} payment domain files checked)`);
