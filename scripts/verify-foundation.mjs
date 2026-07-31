/**
 * Sprint 0 foundation verifier — structural checks only.
 * Does not change product behavior.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredPaths = [
  "docs/migration/README.md",
  "docs/migration/roadmap.md",
  "docs/migration/migration-report-v1.md",
  "docs/migration/coding-standards.md",
  "docs/migration/env-checklist.md",
  "docs/migration/verify-checklist.md",
  "docs/migration/legacy-inventory.md",
  "docs/product/psd-invariants.md",
  "docs/architecture/sad-boundaries.md",
  "docs/architecture/domain-map.md",
  "docs/architecture/infrastructure.md",
  "docs/architecture/verify.md",
  "docs/architecture/modularization.md",
  "docs/database/migrations.md",
  "src/domains/README.md",
  "src/domains/auth/index.ts",
  "src/domains/customer/index.ts",
  "src/domains/provider/index.ts",
  "src/domains/marketplace/index.ts",
  "src/domains/matching/index.ts",
  "src/domains/offer/index.ts",
  "src/domains/unlock/index.ts",
  "src/domains/payment/index.ts",
  "src/domains/notification/index.ts",
  "src/domains/chat/index.ts",
  "src/domains/review/index.ts",
  "src/domains/verification/index.ts",
  "src/domains/admin/index.ts",
  "src/domains/ai/index.ts",
  "src/domains/analytics/index.ts",
  "src/domains/media/index.ts",
  "src/domains/_legacy/index.ts",
  "src/lib/subscription/LEGACY.md",
  "src/lib/search/LEGACY.md",
  "src/lib/search/smart-match/LEGACY.md",
  "src/lib/dalily-ranking/LEGACY.md",
  "src/lib/smart-map/LEGACY.md",
  "src/lib/service-requests/LEGACY.md",
  "src/lib/booking/LEGACY.md",
  "src/app/[locale]/(public)/search/LEGACY.md",
  "src/app/[locale]/(public)/providers/LEGACY.md",
  "src/components/search/LEGACY.md",
  "src/components/business/LEGACY.md",
  ".github/workflows/ci.yml",
];

const missing = requiredPaths.filter((p) => !existsSync(path.join(root, p)));

if (missing.length > 0) {
  console.error("verify:foundation FAILED — missing paths:");
  for (const p of missing) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`verify:foundation OK (${requiredPaths.length} paths checked)`);
