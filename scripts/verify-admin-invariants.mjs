/**
 * Sprint 9 — structural invariants for Admin Migration.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

const flags = readFeatureFlagsSource();
if (!flags.includes("ADMIN_MIGRATION_V2") || !flags.includes("isAdminMigrationV2Enabled")) {
  violations.push("ADMIN_MIGRATION_V2 flag missing");
}

const adminDir = path.join(root, "src", "domains", "admin");
for (const f of ["index.ts", "cell-policies.ts", "unlock-ops.ts", "inspection.ts"]) {
  if (!existsSync(path.join(adminDir, f))) violations.push(`missing domains/admin/${f}`);
}

const unlockOps = readFileSync(path.join(adminDir, "unlock-ops.ts"), "utf8");
if (!unlockOps.includes("compUnlockSession") || !unlockOps.includes("reason")) {
  violations.push("comp unlock must require reason");
}
if (!unlockOps.includes("logAdminAction") || !unlockOps.includes("unlock_comp_granted")) {
  violations.push("comp unlock must audit via admin_action_logs");
}

const cells = readFileSync(path.join(adminDir, "cell-policies.ts"), "utf8");
if (!cells.includes("frozen") || !cells.includes("logAdminAction")) {
  violations.push("cell policies must support freeze + audit");
}

const engine = readFileSync(
  path.join(root, "src", "domains", "matching", "engine.ts"),
  "utf8",
);
if (!engine.includes("cell_frozen") || !engine.includes("getCellPolicy")) {
  violations.push("matching must honor cell freeze when admin flag on");
}

const session = readFileSync(
  path.join(root, "src", "domains", "unlock", "session.ts"),
  "utf8",
);
if (!session.includes("admin_comp")) {
  violations.push("unlock success must support audited admin_comp mode");
}

const subActions = readFileSync(
  path.join(root, "src", "actions", "admin-subscription.actions.ts"),
  "utf8",
);
if (!subActions.includes("subscription_writes_frozen")) {
  violations.push("subscription admin writes must freeze when ADMIN_MIGRATION_V2");
}

const migrations = readdirSync(path.join(root, "supabase", "migrations", "archive"));
const sprint9 = migrations.find((f) => f.includes("sprint9_admin_migration"));
if (!sprint9) violations.push("missing sprint9 admin migration");
else {
  const sql = readFileSync(path.join(root, "supabase", "migrations", "archive", sprint9), "utf8");
  if (!sql.includes("cell_policies") || !sql.includes("frozen")) {
    violations.push("migration must create cell_policies");
  }
}

const notes = path.join(root, "docs", "migration", "sprint-9-notes.md");
if (!existsSync(notes)) violations.push("missing sprint-9-notes.md");
else {
  const n = readFileSync(notes, "utf8");
  if (!n.includes("Moderator") || !n.includes("Platform Admin")) {
    violations.push("notes must document moderator vs admin");
  }
}

const pages = [
  "unlock-ops/page.tsx",
  "cells/page.tsx",
  "inspect/page.tsx",
];
for (const p of pages) {
  const full = path.join(root, "src", "app", "[locale]", "(admin)", "admin", p);
  if (!existsSync(full)) violations.push(`missing admin page ${p}`);
}

if (violations.length) {
  console.error("verify-admin FAILED:");
  for (const v of violations) console.error(" -", v);
  process.exit(1);
}

console.log("verify-admin OK");
