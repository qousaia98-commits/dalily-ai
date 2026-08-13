# scripts/archive

Low-risk hygiene archive from **Sprint 9.5 Phase 1**.

These scripts are **not** wired in root `package.json` and are not part of CI.
They remain available for manual debugging if needed.

## Orphan verify scripts

| File | Purpose |
|------|---------|
| `verify-signup-bootstrap.mjs` | Live DB signup bootstrap checks |
| `verify-beta-critical.mjs` | Beta / seed provider checks |
| `verify-business-register-validation.mjs` | Business register schema mirror |
| `verify-search-query.mjs` | Ad-hoc search query (overlaps active `verify:search*`) |
| `verify-sprint50-stability.mjs` | Pure-function stability checks |

Run manually (from repo root):

```bash
node scripts/archive/verify-signup-bootstrap.mjs
```

## Scratch / one-off tooling

| File | Purpose |
|------|---------|
| `trace-search-pipeline.mjs` | Search pipeline debug |
| `trace-register-business.mjs` | Business register debug |
| `repro-business-register.mjs` | Repro helper |
| `generate-marketplace-repair-migration.js` | One-off migration generator |
| `_final/*` | Local Playwright / provisioning scratch |

**Do not** reintroduce these into CI without review.
