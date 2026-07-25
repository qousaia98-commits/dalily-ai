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
| provider | `src/lib/providers`, `src/lib/business` | Facade re-export |
| marketplace | `src/lib/service-requests` | Facade + LEGACY workflow note |
| matching | `src/domains/matching` (+ salvage ideas from smart-match) | Active (Sprint 3, flag `MATCHING_V2`) |
| offer | quotes via service-requests/actions | Skeleton (Sprint 4) |
| unlock | *(missing)* | Skeleton only |
| payment | `src/lib/payment` | Facade re-export |
| notification | `src/lib/notifications`, business notification inbox | Facade re-export |
| chat | `src/lib/chat`, `src/lib/messaging` | Facade re-export |
| review | `src/lib/reviews` | Facade re-export |
| verification | `src/lib/verification` | Facade re-export |
| admin | `src/lib/admin` | Facade re-export |
| ai | vision/voice/diagnosis/search problem-detection | Facade barrel |
| analytics | admin analytics + learning scores | Skeleton / partial facade |
| media | `src/lib/media`, `src/lib/storage` | Facade re-export |
