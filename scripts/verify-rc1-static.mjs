/**
 * Sprint 9.6 RC1 — orchestrate all verify scripts and write a JSON report.
 * Does not change product behaviour.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "release", "rc1");
mkdirSync(outDir, { recursive: true });

const checks = [
  { id: "typecheck", cmd: "npm run typecheck", critical: true },
  { id: "lint", cmd: "npm run lint", critical: true },
  { id: "build", cmd: "npm run build", critical: true },
  { id: "verify:foundation", cmd: "npm run verify:foundation", critical: true },
  { id: "verify:mobile", cmd: "npm run verify:mobile", critical: true },
  { id: "verify:infra", cmd: "npm run verify:infra", critical: true },
  { id: "verify:db:fresh", cmd: "npm run verify:db:fresh", critical: true },
  { id: "verify:matching", cmd: "npm run verify:matching", critical: false },
  { id: "verify:offers", cmd: "npm run verify:offers", critical: false },
  { id: "verify:unlock", cmd: "npm run verify:unlock", critical: false },
  { id: "verify:payments", cmd: "npm run verify:payments", critical: false },
  { id: "verify:stripe", cmd: "npm run verify:stripe", critical: false },
  { id: "verify:financial-documents", cmd: "npm run verify:financial-documents", critical: false },
  { id: "verify:refunds", cmd: "npm run verify:refunds", critical: false },
  { id: "verify:finance", cmd: "npm run verify:finance", critical: false },
  { id: "verify:reviews", cmd: "npm run verify:reviews", critical: false },
  { id: "verify:reputation", cmd: "npm run verify:reputation", critical: false },
  { id: "verify:quality", cmd: "npm run verify:quality", critical: false },
  { id: "verify:fraud", cmd: "npm run verify:fraud", critical: false },
  { id: "verify:ai-ops", cmd: "npm run verify:ai-ops", critical: false },
  { id: "verify:matching-engine", cmd: "npm run verify:matching-engine", critical: false },
  { id: "verify:pricing", cmd: "npm run verify:pricing", critical: false },
  { id: "verify:forecast", cmd: "npm run verify:forecast", critical: false },
  { id: "verify:scheduling", cmd: "npm run verify:scheduling", critical: false },
  { id: "verify:business-assistant", cmd: "npm run verify:business-assistant", critical: false },
  { id: "verify:marketplace-intelligence", cmd: "npm run verify:marketplace-intelligence", critical: false },
  { id: "verify:chat", cmd: "npm run verify:chat", critical: false },
  { id: "verify:provider-dashboard", cmd: "npm run verify:provider-dashboard", critical: false },
  { id: "verify:admin", cmd: "npm run verify:admin", critical: false },
  { id: "verify:mobile-production", cmd: "npm run verify:mobile-production", critical: false },
  { id: "mobile:typecheck", cmd: "npm run mobile:typecheck", critical: false },
  { id: "validate:i18n", cmd: "npm run validate:i18n", critical: true },
];

const results = [];
let failedCritical = 0;
let failed = 0;
let passed = 0;

function runCheck(cmd) {
  return execSync(cmd, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "example-anon-key",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      DALILY_CLOSED_BETA: process.env.DALILY_CLOSED_BETA || "true",
    },
  });
}

for (const check of checks) {
  const started = Date.now();
  process.stdout.write(`→ ${check.id} ... `);
  const maxAttempts = check.id === "build" ? 2 : 1;
  let lastError = null;
  let ok = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      runCheck(check.cmd);
      ok = true;
      break;
    } catch (error) {
      lastError = error;
      const stderr = String(error.stderr || error.message || "");
      // Windows Next.js worker crash (0xC0000409) — retry once for build only
      const flaky =
        check.id === "build" &&
        (stderr.includes("3221226505") || stderr.includes("exited with code"));
      if (!flaky || attempt === maxAttempts) break;
      process.stdout.write(`retry ${attempt + 1} ... `);
    }
  }
  const ms = Date.now() - started;
  if (ok) {
    console.log(`PASS (${ms}ms)`);
    results.push({ ...check, status: "pass", ms });
    passed += 1;
  } else {
    const stderr = String(lastError?.stderr || lastError?.message || "").slice(-2000);
    console.log(`FAIL (${ms}ms)`);
    results.push({ ...check, status: "fail", ms, stderr });
    failed += 1;
    if (check.critical) failedCritical += 1;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  release: "v3.0.0-RC1",
  sprint: "9.6",
  totals: {
    total: checks.length,
    passed,
    failed,
    failedCritical,
  },
  results,
  verdict: failedCritical === 0 ? "RC1_STATIC_GREEN" : "RC1_BLOCKED",
};

writeFileSync(
  path.join(outDir, "static-validation.json"),
  JSON.stringify(report, null, 2),
);
writeFileSync(
  path.join(outDir, "static-validation.md"),
  `# RC1 Static Validation

Generated: ${report.generatedAt}

## Verdict: **${report.verdict}**

| Metric | Value |
| --- | ---: |
| Total | ${report.totals.total} |
| Passed | ${report.totals.passed} |
| Failed | ${report.totals.failed} |
| Failed critical | ${report.totals.failedCritical} |

## Results

| Check | Status | ms | Critical |
| --- | --- | ---: | --- |
${results
  .map(
    (r) =>
      `| \`${r.id}\` | ${r.status} | ${r.ms} | ${r.critical ? "yes" : "no"} |`,
  )
  .join("\n")}
`,
);

console.log(`\nVerdict: ${report.verdict}`);
if (failedCritical > 0) process.exit(1);
