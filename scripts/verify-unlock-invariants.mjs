/**
 * Sprint 5 — structural invariants for Unlock domain.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unlockDir = path.join(root, "src", "domains", "unlock");

const required = [
  "index.ts",
  "types.ts",
  "session.ts",
  "fallback.ts",
  "contact-gate.ts",
  "payment-port.ts",
];

const missing = required.filter((f) => !existsSync(path.join(unlockDir, f)));
if (missing.length) {
  console.error("verify-unlock FAILED — missing files:", missing.join(", "));
  process.exit(1);
}

const session = readFileSync(path.join(unlockDir, "session.ts"), "utf8");
const contact = readFileSync(path.join(unlockDir, "contact-gate.ts"), "utf8");
const fallback = readFileSync(path.join(unlockDir, "fallback.ts"), "utf8");
const port = readFileSync(path.join(unlockDir, "payment-port.ts"), "utf8");
const violations = [];

if (!session.includes("contact_release_grants")) {
  violations.push("success path must create contact_release_grants");
}
if (!session.includes("UNLOCK_DEV_BYPASS") && !session.includes("isUnlockDevBypassEnabled")) {
  violations.push("grant without payment must gate on UNLOCK_DEV_BYPASS");
}
if (session.includes("canChat")) {
  violations.push("unlock must not use status canChat gate");
}
// Sprint 7 may call ensureFullChatSessionForGrant after grant — not status-open chat
if (
  session.includes('from("conversations")') &&
  !session.includes("ensureFullChatSessionForGrant")
) {
  violations.push("unlock must not open conversations except via chat domain after grant");
}
if (
  session.includes("service_requests") &&
  session.includes(".update({") &&
  session.includes("provider_id:")
) {
  // Soft check — ensure we do not bind provider_id on success
  const bind = /service_requests[\s\S]{0,200}provider_id\s*:/;
  if (bind.test(session) && session.includes("Do NOT set service_requests.provider_id")) {
    // comment documents intentional non-bind — OK
  } else if (/from\("service_requests"\)[\s\S]{0,120}\.update\(\{[\s\S]{0,200}provider_id/.test(session)) {
    violations.push("unlock success must not set service_requests.provider_id");
  }
}
if (!contact.includes("contact_release_grants")) {
  violations.push("contact-gate must check contact_release_grants");
}
if (!contact.includes("phone") || !fallback.includes("fallback_applied")) {
  violations.push("contact gate / fallback idempotency markers missing");
}
if (!port.includes("payment_integration_pending")) {
  violations.push("payment port must fail closed until Sprint 6");
}

const flags = readFileSync(
  path.join(root, "src", "lib", "config", "feature-flags.ts"),
  "utf8",
);
if (!flags.includes("UNLOCK_V2") || !flags.includes("isUnlockV2Enabled")) {
  violations.push("UNLOCK_V2 flag missing");
}
if (!flags.includes("UNLOCK_DEV_BYPASS") || !flags.includes("isUnlockDevBypassEnabled")) {
  violations.push("UNLOCK_DEV_BYPASS flag missing");
}

const migration = path.join(
  root,
  "supabase",
  "migrations",
  "20260725210000_sprint5_unlock_service.sql",
);
if (!existsSync(migration)) {
  violations.push("missing sprint5 unlock migration");
}

const offerCreate = readFileSync(
  path.join(root, "src", "domains", "offer", "create-offer.ts"),
  "utf8",
);
if (!offerCreate.includes("openUnlockSessionForSelection")) {
  violations.push("selectOffer must open unlock session when flag on");
}

const cron = path.join(root, "src", "app", "api", "cron", "unlock-sla", "route.ts");
if (!existsSync(cron)) {
  violations.push("missing unlock-sla cron route");
}

if (violations.length) {
  console.error("verify-unlock FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

const files = readdirSync(unlockDir).filter((f) => f.endsWith(".ts"));
console.log(`verify-unlock OK (${files.length} unlock files checked)`);
