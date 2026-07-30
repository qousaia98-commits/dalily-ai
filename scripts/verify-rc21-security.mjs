/**
 * RC2.1 P0 — structural security & payment invariants (Closed Beta gate).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function mustInclude(rel, needles, label) {
  const src = read(rel);
  for (const n of needles) {
    if (!src.includes(n)) violations.push(`${label}: missing ${n} in ${rel}`);
  }
}

function mustNotInclude(rel, needles, label) {
  const src = read(rel);
  for (const n of needles) {
    if (src.includes(n)) violations.push(`${label}: forbidden pattern ${n} in ${rel}`);
  }
}

// P0-1 Cron fail-closed
const cronDir = path.join(root, "src", "app", "api", "cron");
const cronRoutes = readdirSync(cronDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join("src", "app", "api", "cron", d.name, "route.ts"));

if (cronRoutes.length < 5) {
  violations.push(`expected >=5 cron routes, found ${cronRoutes.length}`);
}

mustInclude(
  "src/lib/security/cron-auth.ts",
  ["timingSafeEqual", "CRON_SECRET", "cron_secret_missing", "Bearer "],
  "cron-auth",
);

for (const route of cronRoutes) {
  mustInclude(route, ["assertCronAuthorized", "cronUnauthorizedResponse"], `cron ${route}`);
  mustNotInclude(route, ["if (secret)"], `cron fail-open ${route}`);
}

// P0-2 Wallet RPC
mustInclude(
  "src/domains/payment/wallet/service.ts",
  ["apply_wallet_ledger_entry", "rpc("],
  "wallet atomicity",
);
mustInclude(
  "supabase/migrations/20260730010000_rc21_p0_security_payment.sql",
  ["FOR UPDATE", "apply_wallet_ledger_entry", "financial_audit_logs"],
  "migration",
);

// P0-3 Escrow refund metadata merge
mustInclude(
  "src/domains/payment/escrow/engine.ts",
  ["mergeEscrowMetadata", "fundedViaFromMetadata", "escrow-refund-release"],
  "escrow refund",
);
const escrowSrc = read("src/domains/payment/escrow/engine.ts");
if (/metadata:\s*\{\s*refundAmount/.test(escrowSrc)) {
  violations.push("escrow refund must not overwrite metadata with only refund fields");
}

// P0-4 IDOR
mustInclude(
  "src/app/api/payments/transactions/route.ts",
  ["canAccessPayment"],
  "payment IDOR",
);
mustInclude(
  "src/app/api/payments/status/route.ts",
  ["canAccessRefund", "canAccessPayment", "canAccessEscrow"],
  "status IDOR",
);

// P0-5 Finance roles
mustInclude(
  "src/lib/auth/roles.ts",
  ["canManageFinance", "FINANCE", "SUPPORT", "canModerateContent"],
  "roles",
);
mustInclude(
  "src/actions/enterprise-payment.actions.ts",
  ["requireFinanceUser"],
  "finance actions",
);
mustNotInclude(
  "src/actions/enterprise-payment.actions.ts",
  ["requireAdminUser"],
  "finance actions must not use requireAdminUser",
);

// P0-6 Dispute authz
mustInclude(
  "src/domains/payment/escrow/engine.ts",
  ["assertEscrowActorAllowed"],
  "dispute authz",
);

// P0-7 State machine
mustInclude(
  "src/lib/payment/state-machine.ts",
  ["canTransitionPaymentStatus", "PAYMENT_STATUS_TRANSITIONS"],
  "state machine",
);
mustInclude(
  "src/lib/payment/orchestration.ts",
  ["canTransitionPaymentStatus", "invalid_transition"],
  "orchestration transitions",
);

// P0-8 Audit
mustInclude(
  "src/domains/payment/audit.ts",
  ["financial_audit_logs", "logFinancialAudit"],
  "audit",
);

if (!existsSync(path.join(root, "supabase/migrations/active/20260730010000_rc21_p0_security_payment.sql"))) {
  violations.push("active migration mirror missing");
}

if (violations.length) {
  console.error("verify-rc21-security FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("verify-rc21-security OK");
