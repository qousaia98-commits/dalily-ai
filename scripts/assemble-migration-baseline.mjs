/**
 * Sprint 9.5 Phase 8 — assemble baseline + archive migration lifecycle.
 *
 * - Does NOT delete historical migrations (moves to archive/)
 * - Builds baseline from verified remote schema dump (public)
 * - Appends idempotent storage.bucket reference inserts from historical migrations
 * - Leaves CLI-active file at migrations root for Supabase CLI
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const archiveDir = path.join(migrationsDir, "archive");
const baselineDir = path.join(migrationsDir, "baseline");
const activeDir = path.join(migrationsDir, "active");
const reportsDir = path.join(root, "docs", "database", "reports");
const dumpPath = path.join(root, "supabase", "_dump_full.sql");

function ensureDir(d) {
  mkdirSync(d, { recursive: true });
}

function listTopLevelMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && /^\d{14}_/.test(f))
    .sort();
}

function extractBucketInserts(sqlFiles) {
  const blocks = [];
  for (const file of sqlFiles) {
    const sql = readFileSync(path.join(migrationsDir, "archive", file), "utf8");
    // Capture INSERT INTO storage.buckets ... ; blocks (including ON CONFLICT if present)
    const re =
      /INSERT INTO\s+storage\.buckets[\s\S]*?;(?:\s*\n(?:(?!INSERT|CREATE|ALTER|DROP|COMMIT|--).)*?ON CONFLICT[\s\S]*?;)?/gi;
    let m;
    while ((m = re.exec(sql))) {
      blocks.push(`-- from archive/${file}\n${m[0].trim()}`);
    }
  }
  // Dedupe by normalized text
  const seen = new Set();
  const unique = [];
  for (const b of blocks) {
    const key = b.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(b);
  }
  return unique;
}

function stats(sql) {
  const c = (re) => (sql.match(re) || []).length;
  return {
    lines: sql.split(/\n/).length,
    types: c(/CREATE TYPE/gi),
    tables: c(/CREATE TABLE/gi),
    views: c(/CREATE(?: OR REPLACE)? VIEW/gi),
    funcs: c(/CREATE(?: OR REPLACE)? FUNCTION/gi),
    indexes: c(/CREATE(?: UNIQUE)? INDEX/gi),
    policies: c(/CREATE POLICY/gi),
    triggers: c(/\bTRIGGER\b/gi),
    rls: c(/ENABLE ROW LEVEL SECURITY/gi),
    extensions: c(/CREATE EXTENSION/gi),
    fks: c(/FOREIGN KEY/gi),
  };
}

ensureDir(archiveDir);
ensureDir(baselineDir);
ensureDir(activeDir);
ensureDir(reportsDir);

if (!existsSync(dumpPath)) {
  console.error("Missing dump:", dumpPath);
  process.exit(1);
}

const historical = listTopLevelMigrations();
console.log(`Found ${historical.length} top-level historical migrations`);

// Move to archive (preserve names) — skip if already archived
for (const file of historical) {
  const from = path.join(migrationsDir, file);
  const to = path.join(archiveDir, file);
  if (existsSync(to)) {
    console.log(`already archived: ${file}`);
    continue;
  }
  renameSync(from, to);
  console.log(`archived: ${file}`);
}

const archived = readdirSync(archiveDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const dumpSql = readFileSync(dumpPath, "utf8");
const dumpStats = stats(dumpSql);

const header = `-- =============================================================================
-- Dalily schema baseline (Sprint 9.5 Phase 8)
-- =============================================================================
-- Source: supabase db dump --linked (project rxalcruoaqpoaiknrnau)
-- Generated: ${new Date().toISOString()}
-- Historical chain archived: supabase/migrations/archive/ (${archived.length} files)
--
-- Purpose:
--   Fresh installs apply THIS file (via active CLI path) instead of replaying
--   the full historical migration chain.
--
-- Existing production:
--   Already applied historical migrations. Do NOT replay archive or baseline
--   against production. See docs/database/migrations.md.
--
-- Seed policy:
--   Schema is seed-independent. Reference buckets are appended idempotently
--   below. Cities/categories/plans seeds live in archive migrations / seed.sql.
-- =============================================================================

`;

const bucketBlocks = extractBucketInserts(archived);
const storageSection = `
-- =============================================================================
-- Storage buckets (reference configuration; platform storage schema assumed)
-- Extracted from archived migrations — idempotent where ON CONFLICT present.
-- =============================================================================
${bucketBlocks
  .map((b) => {
    // Ensure ON CONFLICT DO NOTHING if missing
    if (/ON CONFLICT/i.test(b)) return b;
    return b.replace(/;\s*$/, "\nON CONFLICT (id) DO NOTHING;");
  })
  .join("\n\n")}
`;

const baselineBody = `${header}${dumpSql}\n${storageSection}\n`;
const baselinePath = path.join(baselineDir, "baseline.sql");
writeFileSync(baselinePath, baselineBody, "utf8");

const activeName = "20260728000000_baseline.sql";
const activePath = path.join(activeDir, activeName);
writeFileSync(activePath, baselineBody, "utf8");

// CLI-readable copy at migrations root (Supabase CLI reads top-level *.sql only)
const cliPath = path.join(migrationsDir, activeName);
writeFileSync(cliPath, baselineBody, "utf8");

writeFileSync(
  path.join(activeDir, "README.md"),
  `# Active migrations

Future migrations after the baseline go here **and** must be copied/promoted
to \`supabase/migrations/\` (top-level) so the Supabase CLI can apply them.

Current baseline CLI file: \`../${activeName}\` (identical to \`baseline/baseline.sql\`).
`,
  "utf8",
);

writeFileSync(
  path.join(archiveDir, "README.md"),
  `# Historical migration archive

${archived.length} migrations preserved in chronological order.

- **Do not delete**
- **Do not rewrite**
- Existing environments already applied these versions
- Fresh installs use \`baseline/baseline.sql\` / \`${activeName}\` instead

See \`docs/database/migrations.md\`.
`,
  "utf8",
);

const baselineStats = stats(baselineBody);

const integrity = {
  generatedAt: new Date().toISOString(),
  remoteDump: "supabase/_dump_full.sql",
  archivedCount: archived.length,
  archivedFiles: archived,
  baselineStats,
  dumpStats,
  cliActiveFile: activeName,
  notes: [
    "Baseline derived from live linked schema dump — not naive concatenation",
    "Storage platform schema not recreated; bucket inserts appended",
    "Production must not re-apply baseline if historical versions already recorded",
  ],
};

writeFileSync(
  path.join(reportsDir, "integrity-report.json"),
  JSON.stringify(integrity, null, 2),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      archived: archived.length,
      baselineLines: baselineStats.lines,
      tables: baselineStats.tables,
      policies: baselineStats.policies,
      cliFile: activeName,
    },
    null,
    2,
  ),
);
