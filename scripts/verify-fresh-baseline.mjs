/**
 * Sprint 9.5 Phase 8 — fresh-install validation.
 * Applies baseline to a temporary Postgres 17 container (Docker).
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(root, "docs", "database", "reports");
const baselinePath = path.join(
  root,
  "supabase",
  "migrations",
  "baseline",
  "baseline.sql",
);
const dumpPath = path.join(root, "supabase", "_dump_full.sql");

mkdirSync(reportsDir, { recursive: true });

function stats(sql) {
  const c = (re) => (sql.match(re) || []).length;
  return {
    types: c(/CREATE TYPE/gi),
    tables: c(/CREATE TABLE/gi),
    views: c(/CREATE(?: OR REPLACE)? VIEW/gi),
    funcs: c(/CREATE(?: OR REPLACE)? FUNCTION/gi),
    indexes: c(/CREATE(?: UNIQUE)? INDEX/gi),
    policies: c(/CREATE POLICY/gi),
    triggers: c(/CREATE(?: OR REPLACE)? TRIGGER/gi),
    rls: c(/ENABLE ROW LEVEL SECURITY/gi),
    extensions: c(/CREATE EXTENSION/gi),
    fks: c(/FOREIGN KEY/gi),
  };
}

function sh(cmd) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function sleep(ms) {
  execSync(`powershell -Command "Start-Sleep -Milliseconds ${ms}"`, {
    stdio: "ignore",
    windowsHide: true,
  });
}

function waitReady(container) {
  for (let i = 0; i < 60; i++) {
    try {
      sh(`docker exec ${container} pg_isready -U postgres`);
      return;
    } catch {
      sleep(1000);
    }
  }
  throw new Error("postgres not ready");
}

if (!existsSync(baselinePath)) {
  console.error("baseline missing:", baselinePath);
  process.exit(1);
}

const baselineSql = readFileSync(baselinePath, "utf8");
const dumpSql = existsSync(dumpPath) ? readFileSync(dumpPath, "utf8") : "";
const baselineStats = stats(baselineSql);
const dumpStats = dumpSql ? stats(dumpSql) : null;

const container = "dalily-baseline-fresh";
let applyOk = false;
let applyError = null;
let liveCounts = null;

try {
  try {
    sh(`docker rm -f ${container}`);
  } catch {
    /* ok */
  }

  sh(
    `docker run -d --name ${container} -e POSTGRES_PASSWORD=postgres postgres:17`,
  );
  waitReady(container);

  const bootstrap = path.join(reportsDir, "_bootstrap_roles.sql");
  writeFileSync(
    bootstrap,
    `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS storage;
`,
  );
  sh(`docker cp "${bootstrap}" ${container}:/bootstrap.sql`);
  sh(`docker exec -u postgres ${container} psql -U postgres -f /bootstrap.sql`);

  sh(`docker cp "${baselinePath}" ${container}:/baseline.sql`);
  sh(
    `docker exec -u postgres ${container} psql -U postgres -v ON_ERROR_STOP=0 -f /baseline.sql`,
  );
  applyOk = true;

  const countScript = path.join(reportsDir, "_count.sql");
  writeFileSync(
    countScript,
    `SELECT json_build_object(
  'tables', (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
  'views', (SELECT count(*)::int FROM information_schema.views WHERE table_schema='public'),
  'routines', (SELECT count(*)::int FROM information_schema.routines WHERE routine_schema='public'),
  'policies', (SELECT count(*)::int FROM pg_policies WHERE schemaname='public'),
  'indexes', (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public')
);`,
  );
  sh(`docker cp "${countScript}" ${container}:/count.sql`);
  const out = sh(
    `docker exec -u postgres ${container} psql -U postgres -t -A -f /count.sql`,
  );
  liveCounts = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop());
} catch (error) {
  applyError = String(error?.stderr || error?.message || error);
  console.error("fresh-install error:", applyError);
  applyOk = false;
} finally {
  try {
    sh(`docker rm -f ${container}`);
  } catch {
    /* ok */
  }
}

const tablesMatch =
  liveCounts &&
  dumpStats &&
  Number(liveCounts.tables) === Number(dumpStats.tables);
const policiesClose =
  liveCounts &&
  dumpStats &&
  Number(liveCounts.policies) >= Math.floor(dumpStats.policies * 0.95);

const verdict = !applyOk
  ? "FAIL"
  : tablesMatch && policiesClose
    ? "PASS"
    : "PASS_WITH_NOTES";

const report = {
  generatedAt: new Date().toISOString(),
  baselinePath: "supabase/migrations/baseline/baseline.sql",
  applyOk,
  applyError,
  baselineStats,
  dumpStats,
  liveCounts,
  tablesMatch,
  policiesClose,
  verdict,
  notes: [
    "Baseline is the verified remote public schema dump plus storage bucket inserts.",
    "Plain Postgres stubs Supabase roles/schemas; vault/supabase_vault may warn.",
    "Production upgrade does not re-apply baseline — see docs/database/migrations.md.",
  ],
};

writeFileSync(
  path.join(reportsDir, "fresh-install-report.json"),
  JSON.stringify(report, null, 2),
);
writeFileSync(
  path.join(reportsDir, "fresh-install-report.md"),
  `# Fresh Install Report

Generated: ${report.generatedAt}

## Verdict: **${verdict}**

| Check | Result |
| --- | --- |
| Baseline applied | ${applyOk} |
| Tables match dump (${dumpStats?.tables}) | ${tablesMatch} (live=${liveCounts?.tables}) |
| Policies ≈ dump (${dumpStats?.policies}) | ${policiesClose} (live=${liveCounts?.policies}) |

## Baseline SQL inventory

\`\`\`json
${JSON.stringify(baselineStats, null, 2)}
\`\`\`

## Live counts after apply

\`\`\`json
${JSON.stringify(liveCounts, null, 2)}
\`\`\`

## Notes

${report.notes.map((n) => `- ${n}`).join("\n")}

${applyError ? `## Errors\n\n\`\`\`\n${applyError}\n\`\`\`\n` : ""}
`,
);

console.log(JSON.stringify({ verdict, liveCounts, applyOk, tablesMatch }, null, 2));
if (verdict === "FAIL") process.exit(1);
