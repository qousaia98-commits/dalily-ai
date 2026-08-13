# Sprint 9.5 Phase 6 — Infrastructure consolidation

Infrastructure-only refactor. Repository behaviour unchanged.

## Done

- Split `feature-flags.ts` → `src/lib/config/feature-flags/{core,ai,marketplace,payments,mobile,experimental,index}.ts`
- Env alias catalog + `resolveEnv` + generated `docs/architecture/environment-aliases.md`
- Shared API client `@/lib/api` (http / fetch / retry / auth / errors)
- Provider registry `@/lib/providers` — AI providers re-export resolvers
- Telemetry facade `@/lib/telemetry`
- Config layout: environment / runtime / providers / telemetry
- Docs: `infrastructure.md`, `verify.md`
- Verify scripts read flags via `scripts/lib/read-feature-flags.mjs`
- `npm run verify:infra`

## Not changed

- Business logic, AI prompts, authz, routes, schema, marketplace runtime
- Feature-flag OR semantics and defaults (still OFF unless env set)
