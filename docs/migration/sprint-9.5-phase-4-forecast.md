# Sprint 9.5 Phase 4 — Forecast & Predictive architecture consolidation

**Scope:** Architecture only. No prediction, pricing, scheduling, or API changes.

**Date:** 2026-07-28

## What changed

- Public APIs: `src/domains/forecast` (+ `/client`, types, adapters)
- Forecast Engine remains `src/lib/forecast-engine`
- AI bridge `src/lib/ai/forecasting` thinned (flags / façade)
- Predictive models stay in `src/lib/ai/predictive` (re-exported via domain)
- UI / actions / pages redirected off deep imports
- Canonical flags: `FORECAST_ENGINE`, `PREDICTIVE_ENGINE`, `FORECAST_PROVIDER`
- Docs: `docs/architecture/forecast.md`

## Explicitly NOT changed

- Signal weights / forecast math
- Predictive demand / wait-time algorithms
- Database schema
- Action return shapes

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:foundation
npm run verify:mobile
npm run verify:forecast
```
