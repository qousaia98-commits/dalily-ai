# Marketplace domain (Sprint 1)

## Ownership (SAD)

Marketplace owns:
- Request lifecycle meaning (target phases)
- Selection placeholders (`marketplace_selections`)
- Request projections (`marketplace_request_projections`)
- Job checkpoint ids (light)

Legacy `service_requests` rows remain the **write** system of record in Sprint 1.

## Feature flag

`MARKETPLACE_DOMAIN_V2` — default **off**.

| Flag | Read path | Write path | Chat/Payment |
| --- | --- | --- | --- |
| off | Identical legacy `ServiceRequestDetail` | Legacy actions | Unchanged |
| on | Legacy load + `marketplace` meta + best-effort projection sync | Legacy actions + projection touch | Unchanged |

## Anti-corruption

`legacy-map.ts` maps RFQ statuses → Marketplace phases without changing `canChat()` rules.
