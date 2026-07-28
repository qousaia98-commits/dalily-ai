# Sprint 9.5 Phase 1 — Low-risk cleanup notes

**Scope:** Repository hygiene only. No feature, API, routing, AI, or migration changes.

**Date:** 2026-07-28

## What changed

- Removed empty placeholder directories and empty schema candidate file
- Archived unreferenced verify/scratch scripts under `scripts/archive/`
- Removed unused mobile barrels (`mobile/types`, `mobile/utils`)
- Canonicalized feature-flag examples in `.env.example` (aliases still accepted in code)
- Removed unused root package `@radix-ui/react-dialog`
- Excluded `mobile/` and `scripts/archive/` from root `tsconfig.json` (mobile has its own typecheck; root `@/*` maps to `src/*`)
- Updated README + this note

## Explicitly NOT changed

- Business logic / actions / domains
- Active verify scripts wired in `package.json`
- Supabase migrations (all 77 kept)
- AI engines
- Routes / App Router pages
- Mobile Expo plugins (`expo-system-ui` retained — Expo runtime)
- Brand/public icons used by `generate:brand`

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:foundation
npm run verify:mobile
```
