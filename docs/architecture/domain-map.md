# Domain map (Sprint 0)

## Purpose

Introduce SAD service boundaries in the repository **without moving runtime behavior**.

```
src/domains/
  README.md                 ← this map’s code twin
  auth/
  customer/
  provider/
  marketplace/
  matching/
  offer/
  unlock/
  payment/
    wallet/ escrow/ transactions/ refunds/ payouts/ fees/ invoices/ providers/ shared/ engine/
  notification/
  chat/
  review/
  verification/
  admin/
  ai/
    providers/ engine/ assistant/ pricing/ matching/ translation/
    fraud/ analytics/ forecast/ moderation/ knowledge/ scheduler/ shared/ admin/
  analytics/
  media/
  _legacy/                  ← pointers to LEGACY modules
```

## Facade policy (Sprint 0)

- Each domain `index.ts` may re-export existing `src/lib` symbols **or** export a documented empty placeholder.
- Application code may keep importing `@/lib/...` (unchanged).
- New sprints should prefer `@/domains/<service>` once real ownership moves.
- Do **not** duplicate business logic in facades.

## Current → future ownership

| Domain | Current primary location | Sprint 0 status |
| --- | --- | --- |
| auth | `src/lib/auth` | Facade re-export |
| customer | `src/lib/customer` | Facade re-export |
| provider | `src/domains/provider` + `src/lib/providers`, `src/lib/business` | Active (Sprint 8, flag `PROVIDER_DASHBOARD_V2`) |
| marketplace | `src/lib/service-requests` | Facade + LEGACY workflow note |
| matching | `src/domains/matching` (+ salvage ideas from smart-match) | Active (Sprint 3, flag `MATCHING_V2`) |
| offer | `src/domains/offer` (quotes dual-run legacy) | Active (Sprint 4, flag `OFFERS_V2`) |
| unlock | `src/domains/unlock` | Active (Sprint 5, flag `UNLOCK_V2`) |
| payment | `src/domains/payment` + `src/lib/payment` — see [`payment-domain-boundaries.md`](./payment-domain-boundaries.md) | Active (Sprint 6 + Sprint 10 Phase 4, flags `PAYMENTS_V2` / `PAYMENT_WALLET` / `ESCROW_ENGINE`) |
| notification | `src/lib/notifications`, business notification inbox | Facade re-export |
| chat | `src/domains/chat` + `src/lib/chat`, `src/lib/messaging` | Active (Sprint 7, flag `CHAT_AUTH_V2`) |
| review | `src/lib/reviews` | Facade re-export |
| verification | `src/lib/verification` | Facade re-export |
| admin | `src/domains/admin` + `src/lib/admin` | Active (Sprint 9, flag `ADMIN_MIGRATION_V2`) |
| ai | `src/domains/ai` + `src/lib/ai` (+ matching/forecast/fraud/pricing bridges) | Active (Sprint 10 Phase 5, flag `AI_PLATFORM`) |
| analytics | admin analytics + learning scores | Skeleton / partial facade |
| media | `src/lib/media`, `src/lib/storage` | Facade re-export |
