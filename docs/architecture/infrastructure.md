# Infrastructure (Sprint 9.5 Phase 6)

Canonical infrastructure layer for Dalily. **No business / AI / auth / API / schema behaviour changes** — structure only.

## Infrastructure Overview

```
Application
    ↓
Domains
    ↓
Infrastructure
├── feature-flags     src/lib/config/feature-flags/
├── config            src/lib/config/{environment,runtime,providers,telemetry}/
├── providers         src/lib/providers/
├── api-client        src/lib/api/
├── verify            scripts/verify-*.mjs + docs/architecture/verify.md
├── telemetry         src/lib/telemetry/
    ↓
Runtime
```

## Feature Flags

Modular package (one feature per definition, one docs source, one exported API):

| Module | Path |
| --- | --- |
| Core | `src/lib/config/feature-flags/core.ts` |
| AI | `src/lib/config/feature-flags/ai.ts` |
| Marketplace | `src/lib/config/feature-flags/marketplace.ts` |
| Payments | `src/lib/config/feature-flags/payments.ts` |
| Mobile | `src/lib/config/feature-flags/mobile.ts` |
| Experimental | `src/lib/config/feature-flags/experimental.ts` |
| Public API | `src/lib/config/feature-flags/index.ts` |

Import: `@/lib/config/feature-flags` (unchanged).

Client-safe helpers remain in `feature-flags-client.ts`.

## Configuration

| Area | Path |
| --- | --- |
| Environment aliases | `src/lib/config/environment/` |
| Feature flags | `src/lib/config/feature-flags/` |
| Providers (re-export) | `src/lib/config/providers/` |
| Runtime | `src/lib/config/runtime/` |
| Telemetry (re-export) | `src/lib/config/telemetry/` |

Avoid oversized single config files — split by concern.

## Providers

Provider **selection** lives only in `@/lib/providers`:

- `interfaces.ts` — provider IDs / kinds
- `registry.ts` — known providers + implementation status
- `resolver.ts` — env → effective provider (unimplemented IDs map to current defaults)

AI OpenAI HTTP clients remain in `src/lib/ai/providers/` and **re-export** resolvers from `@/lib/providers`. Bridges must not invent their own env resolution.

## API Client

Shared outbound HTTP: `@/lib/api`

| Module | Role |
| --- | --- |
| `http.ts` | AbortController + timeout |
| `fetch.ts` | `fetchWithTimeout` |
| `retry.ts` | Opt-in retry (default unused) |
| `auth.ts` | Bearer / JSON headers |
| `errors.ts` | `ApiClientError` |
| `types.ts` | Shared types |

OpenAI chat/whisper, chat AI helper, and search LLM detector use this layer. No duplicated timeout wiring for those paths.

## Telemetry

Canonical entry: `@/lib/telemetry`

- Logging → `observability/logger`
- Metrics / tracing / feature breadcrumbs → structured log placeholders (no second logger)

Do not add parallel `console.*` wrappers for app telemetry.

## Environment

Canonical key → alias resolver → runtime:

```ts
import { resolveEnv } from "@/lib/config/environment";
resolveEnv("OCR_PROVIDER"); // also accepts VISION_PROVIDER
```

Alias catalog: `src/lib/config/environment/aliases.ts`  
Generated docs: [`environment-aliases.md`](./environment-aliases.md)

Feature flags keep explicit `envFlag("NAME")` OR-chains (identical runtime). Provider **string** IDs use `resolveEnv`.

## Verify Strategy

See [`verify.md`](./verify.md).

## Allowed Imports

| From | May import |
| --- | --- |
| Domains / app | `@/lib/config/feature-flags`, `@/lib/providers`, `@/lib/api`, `@/lib/telemetry` |
| AI bridges / engines | `@/lib/providers` for selection; `@/lib/ai/providers` for OpenAI HTTP |
| `src/lib/ai/providers` | `@/lib/providers`, `@/lib/api` |
| Feature-flag modules | `./core` only among siblings |

## Forbidden Imports

| Do not | Why |
| --- | --- |
| Resolve providers via ad-hoc `process.env.*_PROVIDER` in bridges | Use `@/lib/providers` |
| New AbortController+timeout fetch wrappers | Use `@/lib/api` |
| Duplicate feature-flag definitions outside `feature-flags/` | Single source |
| Import domain barrels from infrastructure | Keep infra leaf-only |
| Circular: `providers` → `ai/providers` → `providers` | AI re-exports only |
