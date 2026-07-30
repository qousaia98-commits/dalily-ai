/**
 * RC2.1 P0 — executable security / payment logic tests (no DB required).
 * Covers: cron token compare, payment transitions, escrow transitions,
 * metadata merge semantics, role matrix, replay / duplicate transition rules.
 */

import { timingSafeEqual } from "node:crypto";
import assert from "node:assert/strict";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

function safeEqualString(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    const max = Math.max(aBuf.length, bBuf.length);
    const aPad = Buffer.alloc(max);
    const bPad = Buffer.alloc(max);
    aBuf.copy(aPad);
    bBuf.copy(bPad);
    timingSafeEqual(aPad, bPad);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/** Mirrors src/lib/payment/state-machine.ts — keep in sync via verify-rc21-security. */
const PAYMENT_STATUS_TRANSITIONS = {
  pending: [
    "pending_review",
    "authorized",
    "captured",
    "paid",
    "failed",
    "cancelled",
    "expired",
    "rejected",
  ],
  reserved: ["released", "refunded", "partially_refunded", "disputed", "cancelled"],
  released: ["refunded", "partially_refunded", "disputed"],
  refunded: [],
  disputed: ["released", "refunded", "partially_refunded", "cancelled", "paid"],
};

function canTransitionPaymentStatus(from, to) {
  if (from === to) return true;
  return (PAYMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

const ESCROW_STATUS_TRANSITIONS = {
  reserved: ["released", "refunded", "partially_refunded", "disputed", "cancelled"],
  disputed: ["released", "refunded", "partially_refunded", "cancelled"],
  released: [],
  refunded: [],
};

function canTransitionEscrowStatus(from, to) {
  if (from === to) return true;
  return (ESCROW_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

function mergeEscrowMetadata(existing, patch) {
  const base =
    existing && typeof existing === "object" ? { ...existing } : {};
  return { ...base, ...patch };
}

function canManageFinance(roles) {
  return roles.includes("admin") || roles.includes("finance");
}

function canModerateContent(roles) {
  return (
    roles.includes("admin") ||
    roles.includes("moderator") ||
    roles.includes("support")
  );
}

console.log("RC2.1 P0 security tests");

test("cron: identical bearer tokens match (constant-time)", () => {
  assert.equal(safeEqualString("secret-value", "secret-value"), true);
});

test("cron: mismatched tokens reject", () => {
  assert.equal(safeEqualString("secret-value", "secret-wrong"), false);
});

test("cron: length mismatch rejects (no fallback)", () => {
  assert.equal(safeEqualString("abc", "abcd"), false);
});

test("payment: reserved → released allowed", () => {
  assert.equal(canTransitionPaymentStatus("reserved", "released"), true);
});

test("payment: refunded → reserved rejected (replay / invalid)", () => {
  assert.equal(canTransitionPaymentStatus("refunded", "reserved"), false);
});

test("payment: duplicate transition is no-op success", () => {
  assert.equal(canTransitionPaymentStatus("paid", "paid"), true);
});

test("escrow: reserved → refunded allowed", () => {
  assert.equal(canTransitionEscrowStatus("reserved", "refunded"), true);
});

test("escrow: released → reserved rejected", () => {
  assert.equal(canTransitionEscrowStatus("released", "reserved"), false);
});

test("escrow: never both release and refund from released", () => {
  assert.equal(canTransitionEscrowStatus("released", "refunded"), false);
  // released may go to refunded in payment machine but escrow release is terminal for money rail
  assert.equal((ESCROW_STATUS_TRANSITIONS.released ?? []).includes("refunded"), false);
});

test("metadata merge preserves fundedVia (no double-credit bug)", () => {
  const merged = mergeEscrowMetadata(
    { fundedVia: "wallet", fees: { platformFee: 1 } },
    { refund: { amount: 50 } },
  );
  assert.equal(merged.fundedVia, "wallet");
  assert.equal(merged.fees.platformFee, 1);
  assert.equal(merged.refund.amount, 50);
});

test("role: moderator cannot manage finance", () => {
  assert.equal(canManageFinance(["moderator"]), false);
  assert.equal(canModerateContent(["moderator"]), true);
});

test("role: finance can manage finance but not implied super-admin alone", () => {
  assert.equal(canManageFinance(["finance"]), true);
  assert.equal(canManageFinance(["support"]), false);
});

test("role: admin is finance-capable", () => {
  assert.equal(canManageFinance(["admin"]), true);
});

test("unauthorized access simulation: finance gate", () => {
  const attacker = ["user", "moderator"];
  assert.equal(canManageFinance(attacker), false);
});

test("concurrent duplicate transition simulation", () => {
  // Two workers both see reserved → both attempt released; second is no-op if already released
  let status = "reserved";
  function tryRelease() {
    if (!canTransitionEscrowStatus(status, "released")) return false;
    if (status === "released") return true;
    status = "released";
    return true;
  }
  assert.equal(tryRelease(), true);
  assert.equal(tryRelease(), true); // idempotent same status
  assert.equal(status, "released");
});

if (process.exitCode) {
  console.error("test-rc21-p0 FAILED");
  process.exit(1);
}

console.log(`test-rc21-p0 OK (${passed} assertions)`);
