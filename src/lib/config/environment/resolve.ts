/**
 * Environment alias resolver (Sprint 9.5 Phase 6).
 *
 * Canonical Key → Alias Resolver → Runtime
 * Aliases remain accepted; prefer canonical keys in new config.
 */

import { ENV_ALIASES } from "./aliases";

export function resolveEnv(canonical: string): string | undefined {
  const entry = ENV_ALIASES.find((e) => e.canonical === canonical);
  const keys = entry
    ? [entry.canonical, ...entry.aliases]
    : [canonical];
  for (const key of keys) {
    const raw = process.env[key];
    if (raw !== undefined && raw !== "") return raw;
  }
  return undefined;
}

export function resolveEnvFlag(canonical: string): boolean {
  const raw = resolveEnv(canonical);
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}

/** Markdown table for docs generation. */
export function formatEnvAliasMarkdown(): string {
  const lines = [
    "| Canonical | Aliases (deprecated/accepted) | Category | Notes |",
    "| --- | --- | --- | --- |",
  ];
  for (const e of ENV_ALIASES) {
    lines.push(
      `| \`${e.canonical}\` | ${
        e.aliases.length ? e.aliases.map((a) => `\`${a}\``).join(", ") : "—"
      } | ${e.category} | ${e.notes ?? ""} |`,
    );
  }
  return lines.join("\n");
}
