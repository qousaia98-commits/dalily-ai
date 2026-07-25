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
  notification/
  chat/
  review/
  verification/
  admin/
  ai/
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
| payment | `src/domains/payment` + `src/lib/payment` | Active (Sprint 6, flag `UNLOCK_PAYMENTS_V2`) |
| notification | `src/lib/notifications`, business notification inbox | Facade re-export |
| chat | `src/domains/chat` + `src/lib/chat`, `src/lib/messaging` | Active (Sprint 7, flag `CHAT_AUTH_V2`) |
| review | `src/lib/reviews` | Facade re-export |
| verification | `src/lib/verification` | Facade re-export |
| admin | `src/domains/admin` + `src/lib/admin` | Active (Sprint 9, flag `ADMIN_MIGRATION_V2`) |
| ai | vision/voice/diagnosis/search problem-detection | Facade barrel |
| analytics | admin analytics + learning scores | Skeleton / partial facade |
| media | `src/lib/media`, `src/lib/storage` | Facade re-export |
