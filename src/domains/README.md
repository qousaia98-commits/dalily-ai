# src/domains — SAD logical service boundaries

Sprint 0 introduces these folders as **architecture boundaries**.

- Runtime behavior still lives in `src/lib/**` (and app routes).
- Facades export domain metadata and selective re-exports only.
- Do not add product features here in Sprint 0.
- See `docs/architecture/domain-map.md` and `docs/architecture/sad-boundaries.md`.

## Services

| Folder | SAD service |
| --- | --- |
| `auth` | Auth |
| `customer` | Customer |
| `provider` | Provider |
| `marketplace` | Marketplace |
| `matching` | Matching |
| `offer` | Offer |
| `unlock` | Unlock |
| `payment` | Payment |
| `notification` | Notification |
| `chat` | Chat |
| `review` | Review |
| `verification` | Verification |
| `admin` | Admin |
| `ai` | AI |
| `analytics` | Analytics |
| `media` | Media |
| `_legacy` | Pointers to LEGACY inventory |

## Import policy

- Existing code: keep `@/lib/...` imports (unchanged in Sprint 0).
- Future sprints: move ownership, then switch callers to `@/domains/<service>`.
