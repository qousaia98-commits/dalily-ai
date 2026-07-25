/**
 * Sprint 7 — structural invariants for Chat Authorization on contact_release_grants.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chatDir = path.join(root, "src", "domains", "chat");

const required = ["index.ts", "authz.ts", "session.ts"];
const missing = required.filter((f) => !existsSync(path.join(chatDir, f)));
if (missing.length) {
  console.error("verify-chat FAILED — missing files:", missing.join(", "));
  process.exit(1);
}

const authz = readFileSync(path.join(chatDir, "authz.ts"), "utf8");
const session = readFileSync(path.join(chatDir, "session.ts"), "utf8");
const unlockSession = readFileSync(
  path.join(root, "src", "domains", "unlock", "session.ts"),
  "utf8",
);
const chatActions = readFileSync(
  path.join(root, "src", "actions", "chat.actions.ts"),
  "utf8",
);
const flags = readFileSync(
  path.join(root, "src", "lib", "config", "feature-flags.ts"),
  "utf8",
);
const violations = [];

if (!flags.includes("CHAT_AUTH_V2") || !flags.includes("isChatAuthV2Enabled")) {
  violations.push("CHAT_AUTH_V2 flag missing");
}
if (!authz.includes("contact_release_grants") || !authz.includes("canAccessFullChat")) {
  violations.push("authz must gate on contact_release_grants");
}
if (!authz.includes("assertChatParticipants")) {
  violations.push("assertChatParticipants required for server-side participant gate");
}
if (!session.includes("ensureFullChatSessionForGrant") || !session.includes("thread_kind")) {
  violations.push("idempotent full chat session create required");
}
if (!session.includes("grant_required") || !session.includes("23505")) {
  violations.push("session create must require grant and handle unique races");
}
if (!chatActions.includes("assertChatParticipants") && !chatActions.includes("isChatAuthV2Enabled")) {
  violations.push("chat.actions must use Sprint 7 authz when flag on");
}
if (!unlockSession.includes("ensureFullChatSessionForGrant")) {
  violations.push("unlock success must ensure full chat session when CHAT_AUTH_V2");
}

const migrations = readdirSync(path.join(root, "supabase", "migrations"));
const sprint7 = migrations.find((f) => f.includes("sprint7_chat_authorization"));
if (!sprint7) {
  violations.push("missing sprint7 chat authorization migration");
} else {
  const sql = readFileSync(path.join(root, "supabase", "migrations", sprint7), "utf8");
  if (!sql.includes("has_chat_release_grant") || !sql.includes("conversation_allows_message_insert")) {
    violations.push("migration must add grant-aware RLS helpers");
  }
  if (!sql.includes("legacy_backfill") || !sql.includes("thread_kind")) {
    violations.push("migration must backfill grants and add thread_kind");
  }
  if (!sql.includes("messages_participant_insert")) {
    violations.push("migration must replace messages insert RLS");
  }
}

const publicDb = readFileSync(
  path.join(root, "src", "lib", "providers", "database.ts"),
  "utf8",
);
if (!publicDb.includes("isChatAuthV2Enabled") || !publicDb.includes("hidePublicContact")) {
  violations.push("public provider profile must hide phone when CHAT_AUTH_V2");
}

if (violations.length) {
  console.error("verify-chat FAILED:");
  for (const v of violations) console.error(" -", v);
  process.exit(1);
}

console.log("verify-chat OK — chat auth invariants hold");
