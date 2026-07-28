/**
 * Sprint 9.5 Phase 6 — infrastructure structural invariants.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFeatureFlagsSource } from "./lib/read-feature-flags.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function mustExist(rel) {
  if (!existsSync(path.join(root, rel))) violations.push(`missing ${rel}`);
}

const required = [
  "src/lib/config/feature-flags/index.ts",
  "src/lib/config/feature-flags/core.ts",
  "src/lib/config/feature-flags/ai.ts",
  "src/lib/config/feature-flags/marketplace.ts",
  "src/lib/config/feature-flags/payments.ts",
  "src/lib/config/feature-flags/mobile.ts",
  "src/lib/config/feature-flags/experimental.ts",
  "src/lib/config/environment/index.ts",
  "src/lib/config/environment/aliases.ts",
  "src/lib/config/environment/resolve.ts",
  "src/lib/config/runtime/index.ts",
  "src/lib/config/providers/index.ts",
  "src/lib/config/telemetry/index.ts",
  "src/lib/api/index.ts",
  "src/lib/api/http.ts",
  "src/lib/api/fetch.ts",
  "src/lib/api/retry.ts",
  "src/lib/api/auth.ts",
  "src/lib/api/errors.ts",
  "src/lib/api/types.ts",
  "src/lib/providers/index.ts",
  "src/lib/providers/registry.ts",
  "src/lib/providers/resolver.ts",
  "src/lib/providers/interfaces.ts",
  "src/lib/telemetry/index.ts",
  "docs/architecture/infrastructure.md",
  "docs/architecture/verify.md",
  "docs/architecture/environment-aliases.md",
  "docs/database/migrations.md",
  "supabase/migrations/baseline/baseline.sql",
  "supabase/migrations/20260728000000_baseline.sql",
];

for (const p of required) mustExist(p);

if (!existsSync(path.join(root, "supabase/migrations/archive"))) {
  violations.push("missing migrations/archive/");
} else {
  const archived = readdirSync(path.join(root, "supabase/migrations/archive")).filter((f) =>
    f.endsWith(".sql"),
  );
  if (archived.length < 70) {
    violations.push(`archive too small: ${archived.length} sql files`);
  }
}

// Monolith must be gone (folder only)
if (existsSync(path.join(root, "src/lib/config/feature-flags.ts"))) {
  violations.push("legacy feature-flags.ts must not coexist with feature-flags/");
}

const flags = readFeatureFlagsSource();
for (const name of [
  "isChatEngineEnabled",
  "isForecastEngineEnabled",
  "isVisionEngineEnabled",
  "isSpeechEngineEnabled",
  "isSmartMatchingEngineEnabled",
  "envFlag",
]) {
  if (!flags.includes(name)) violations.push(`flag export missing: ${name}`);
}

const apiFetch = readFileSync(path.join(root, "src/lib/api/fetch.ts"), "utf8");
if (!apiFetch.includes("withTimeout") || !apiFetch.includes("fetchWithTimeout")) {
  violations.push("api/fetch must use shared withTimeout");
}

const openaiWhisper = readFileSync(
  path.join(root, "src/lib/ai/providers/openai-whisper.ts"),
  "utf8",
);
if (
  !openaiWhisper.includes("@/lib/api") ||
  openaiWhisper.includes("new AbortController")
) {
  violations.push("openai-whisper must use @/lib/api (no local AbortController)");
}

const openaiChat = readFileSync(
  path.join(root, "src/lib/ai/providers/openai-chat.ts"),
  "utf8",
);
if (!openaiChat.includes("@/lib/api") || openaiChat.includes("new AbortController")) {
  violations.push("openai-chat must use @/lib/api (no local AbortController)");
}

const aiProviders = readFileSync(
  path.join(root, "src/lib/ai/providers/index.ts"),
  "utf8",
);
if (
  !aiProviders.includes("@/lib/providers") ||
  aiProviders.includes("process.env.OCR_PROVIDER")
) {
  violations.push("ai/providers must resolve via @/lib/providers");
}

const resolver = readFileSync(
  path.join(root, "src/lib/providers/resolver.ts"),
  "utf8",
);
if (!resolver.includes("resolveEnv") || !resolver.includes("resolveVisionProvider")) {
  violations.push("providers/resolver must use environment resolveEnv");
}

// No second retry helper besides api/retry (lightweight check)
const retryFiles = [];
function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      const text = readFileSync(full, "utf8");
      if (
        text.includes("export async function withRetry") ||
        text.includes("export function withRetry")
      ) {
        retryFiles.push(path.relative(root, full));
      }
    }
  }
}
walk(path.join(root, "src/lib"));
const unexpectedRetry = retryFiles.filter(
  (f) => f !== path.join("src", "lib", "api", "retry.ts").replace(/\\/g, "/") &&
    f.replace(/\\/g, "/") !== "src/lib/api/retry.ts",
);
if (unexpectedRetry.length) {
  violations.push(`duplicate withRetry: ${unexpectedRetry.join(", ")}`);
}

if (violations.length) {
  console.error("verify:infra FAILED");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`verify:infra OK (${required.length} paths + structural checks)`);
