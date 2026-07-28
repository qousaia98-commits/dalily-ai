/**
 * Read concatenated feature-flag module sources for structural verify scripts.
 * Sprint 9.5 Phase 6 — flags live under src/lib/config/feature-flags/.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function featureFlagsDir() {
  return path.join(root, "src", "lib", "config", "feature-flags");
}

/** Concatenated TypeScript sources (all modules) for string-invariant checks. */
export function readFeatureFlagsSource() {
  const dir = featureFlagsDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}
