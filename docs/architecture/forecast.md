# Forecast & Predictive Architecture

Sprint 9.5 Phase 4 — architecture consolidation only.  
Forecast accuracy, prediction models, and API responses are unchanged.

## Architecture

```
UI / Pages / Actions
        ↓
src/domains/forecast          ← sole public entry (server)
src/domains/forecast/client   ← client-safe types
        ↓
src/lib/forecast-engine       ← Forecast Engine (demand product)
src/lib/ai/forecasting        ← thin AI Forecast Bridge
src/lib/ai/predictive         ← Predictive model layer (Phase 8)
        ↓
Database (forecast_* / ai_* tables)
```

No LLM provider calls in the current forecast path (signal + history based).  
`FORECAST_PROVIDER` is reserved for future multi-provider routing via `src/lib/ai/providers`.

## Public API

**Server:**

```ts
import {
  generateForecast,
  getCustomerDemandHint,
  getProviderForecastInsights,
  getAdminForecastDashboard,
  forecastDemand,
  estimateWaitTime,
  buildAdminPredictiveDashboard,
  type CustomerDemandHint,
  type WaitTimeEstimate,
} from "@/domains/forecast";
```

**Client:**

```ts
import type {
  CustomerDemandHint,
  ProviderForecastInsights,
  AdminForecastDashboard,
  ForecastHorizon,
} from "@/domains/forecast/client";
```

## Forecast Flow (Sprint 8 engine)

1. Flag: `isForecastEngineEnabled()` (`FORECAST_ENGINE` or `AI_DEMAND_FORECASTING*`)
2. Collect signals → `computeForecastFromSignals`
3. Persist history / market snapshots (advisory)
4. Public views: provider insights, customer hint, admin center

## Prediction Flow (Phase 8 models)

1. Flag: `isPredictiveEngineEnabled()` (`PREDICTIVE_ENGINE` or `AI_ENGINE_V8+`)
2. Algorithms: `forecastDemand`, wait-time, availability, balancer, notifications
3. Used on waiting room / business home / admin AI predictions
4. Distinct from Sprint-8 weighted forecast-engine (do not conflate types)

## AI Bridge

`src/lib/ai/forecasting` — façade + flag gate for `getPublicDemandForecasts`.  
No forecasting math.

## Feature Flags

| Canonical | Legacy aliases |
|-----------|----------------|
| `FORECAST_ENGINE` | `AI_DEMAND_FORECASTING`, `_V1`, `DEMAND_FORECASTING` |
| `PREDICTIVE_ENGINE` | `AI_ENGINE_V8`, `AI_ENGINE_V9` |
| `FORECAST_PROVIDER` | `PREDICTION_PROVIDER` (default `openai`, unused at runtime today) |

## Allowed / Forbidden Imports

| From | May import |
|------|------------|
| UI / actions / pages (server) | `@/domains/forecast` |
| `"use client"` UI | `@/domains/forecast/client` |
| Domain adapters | `lib/forecast-engine`, `lib/ai/forecasting`, `lib/ai/predictive` |

| From | Must not import |
|------|-----------------|
| UI / actions / pages | `@/lib/forecast-engine/**`, `@/lib/ai/predictive/**`, `@/lib/ai/forecasting/**` |

## File classification

| Path | Class |
|------|--------|
| `domains/forecast/*` | Public API / Shared Types |
| `lib/forecast-engine/*` | Forecast Engine / Scoring / Telemetry |
| `lib/ai/forecasting` | AI Bridge |
| `lib/ai/predictive/*` | Predictive Model |
| `domains/forecast/adapters/*` | Adapter |

## Future ML Integration

- Keep `ML_FORECAST_COLLECTOR` in forecast-engine as extension point
- Route external models behind `FORECAST_ENGINE` / bridge only
- Do not add a second public entry
