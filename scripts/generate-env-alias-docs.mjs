/**
 * Generate docs/architecture/environment-aliases.md from the alias catalog.
 */

import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aliasesPath = path.join(root, "src/lib/config/environment/aliases.ts");
const outPath = path.join(root, "docs/architecture/environment-aliases.md");

const src = readFileSync(aliasesPath, "utf8");
const arrayStart = src.indexOf("export const ENV_ALIASES");
const braceStart = src.indexOf("[", arrayStart);
const braceEnd = src.indexOf("] as const", braceStart);
if (arrayStart < 0 || braceStart < 0 || braceEnd < 0) {
  console.error("Could not locate ENV_ALIASES array");
  process.exit(1);
}

const body = src.slice(braceStart + 1, braceEnd);
const chunks = body.split(/\n\s*\{\s*\n/).slice(1);
const entries = [];

for (const chunk of chunks) {
  const canonical = chunk.match(/canonical:\s*"([^"]+)"/)?.[1];
  const category = chunk.match(/category:\s*"([^"]+)"/)?.[1];
  const notes = chunk.match(/notes:\s*"([^"]*)"/)?.[1] ?? "";
  const aliasesBlock = chunk.match(/aliases:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const aliases = [...aliasesBlock.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (!canonical || !category) continue;
  entries.push({ canonical, aliases, category, notes });
}

if (entries.length === 0) {
  console.error("Parsed 0 alias entries — aborting to avoid wiping docs");
  process.exit(1);
}

const lines = [
  "# Environment aliases (generated)",
  "",
  "> Source of truth: `src/lib/config/environment/aliases.ts`",
  "> Regenerate: `node scripts/generate-env-alias-docs.mjs`",
  "",
  "| Canonical | Aliases (deprecated/accepted) | Category | Notes |",
  "| --- | --- | --- | --- |",
];

for (const e of entries) {
  const aliasCell = e.aliases.length
    ? e.aliases.map((a) => `\`${a}\``).join(", ")
    : "—";
  lines.push(
    `| \`${e.canonical}\` | ${aliasCell} | ${e.category} | ${e.notes} |`,
  );
}

lines.push("");
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(
  `Wrote ${entries.length} alias rows → ${path.relative(root, outPath)}`,
);
