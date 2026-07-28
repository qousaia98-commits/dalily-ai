# Verify Strategy (Sprint 9.5 Phase 6)

Structural / invariant scripts — they do **not** change product behaviour.

## Categories

| Category | Scripts (`npm run …`) | Purpose |
| --- | --- | --- |
| **Foundation** | `verify:foundation` | Domains, LEGACY markers, SAD docs present |
| **Marketplace** | `verify:matching`, `verify:offers`, `verify:unlock`, `verify:provider-dashboard`, `verify:admin`, `verify:chat` | Core marketplace strangler invariants |
| **Payments** | `verify:payments`, `verify:stripe`, `verify:financial-documents`, `verify:refunds`, `verify:finance` | Unlock fees, Stripe, finance |
| **AI** | `verify:matching-engine`, `verify:pricing`, `verify:forecast`, `verify:scheduling`, `verify:business-assistant`, `verify:marketplace-intelligence`, `verify:reviews`, `verify:reputation`, `verify:quality`, `verify:fraud`, `verify:ai-ops` | AI / intelligence engines |
| **Database** | `verify:search:db` | Live DB integration (manual / env-gated) |
| **Performance** | — | Reserved (no dedicated script yet) |
| **Security** | (covered inside domain verifies + CI lint/typecheck) | No separate exploit scripts |
| **Mobile** | `verify:mobile`, `verify:mobile-customer`, `verify:mobile-provider`, `verify:mobile-native`, `verify:mobile-production` | Expo app foundation / release |
| **CI** | `.github/workflows/ci.yml` | foundation, i18n, lint, typecheck, mobile-production, build |
| **Manual** | `verify:search`, `verify:search:llm`, `validate:sprint6` | Needs secrets / human judgment |
| **Infrastructure** | `verify:infra` | Phase 6 structural checks |

## CI

Runs on push/PR to `main`/`master`:

1. `verify:foundation`
2. `validate:i18n`
3. `lint`
4. `typecheck`
5. `verify:mobile-production`
6. `build` (placeholder public env)

## Nightly

Recommended (not wired in GitHub Actions yet):

- Full AI suite: matching-engine, pricing, forecast, scheduling, business-assistant, marketplace-intelligence
- Marketplace suite: matching, offers, unlock, payments, chat, provider-dashboard, admin
- `verify:infra`

## Manual

- `verify:search:db` / `verify:search:llm` — need live Supabase / LLM keys
- Stripe live path checks beyond structural `verify:stripe`

## Deprecated

- Reading `src/lib/config/feature-flags.ts` as a single file — use `scripts/lib/read-feature-flags.mjs` (concatenates `feature-flags/*.ts`)
- Legacy env alias names — still accepted; prefer canonical keys in `environment/aliases.ts`

## Experimental

- `isSprint55Stabilization()` — always `true`; docs/CI marker only
- Unimplemented provider IDs in registry (azure_openai, anthropic, …) — resolve to current defaults

## Local quick gate (Phase 6)

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:foundation
npm run verify:mobile
npm run verify:infra
```
