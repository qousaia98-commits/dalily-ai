# Dalily 2.0 – SAD Boundaries (Immutable)

**Source:** Official Software Architecture Document (FINAL)  
**Note:** Technology choices (DB, hosting, frameworks) remain deferred. This file defines **logical** ownership only.

## Architectural philosophy

- Design for marketplace invariants, not screens.
- Modular domain boundaries; co-deployed initially is allowed if ownership stays separate.
- Cell-native scalability (city × category policies).
- Event-evident history for critical transitions.
- Privacy and money paths are hostile zones (fail closed).
- Explainability via reason codes.
- Avoid rewrites by freezing contracts and ownership, not stacks.

## Logical services and ownership

| Service | Owns | Must not directly modify |
| --- | --- | --- |
| Auth | Identity, sessions | Domain ledgers |
| Customer | Customer profile/prefs | Provider/unlock/payment |
| Provider | Business profile, areas, capabilities, pause | Requests/offers/unlocks |
| Marketplace | Request lifecycle, selection, job checkpoints | Payment capture, chat messages |
| Matching | Pools, assignments, reason codes, throttle decisions | Offers, payments, PII release |
| Offer | Offers, templates, offer quality flags | Selection finalization beyond submit |
| Unlock | Unlock sessions, SLA, **contact release grants** | Raw payment processor state |
| Payment | Payment intents/charges/refunds metadata | Chat open / PII grant without Unlock |
| Notification | Delivery attempts, templates routing | Domain truth |
| Chat | Q&A + full threads (authZ checks grant) | Grants |
| Review | Ratings/reviews | Matching scores directly |
| Verification | Verification cases/status | Provider profile core fields except status projection |
| Admin | Cases, cell overrides, audited commands | Silent DB edits of other stores |
| AI | Suggestion artifacts (advisory) | Money, PII release, auto-select |
| Analytics | Derived KPIs/features | Authoritative unlock/money |
| Media | Blobs + ACL metadata | Business rules of unlock |

## Hard rules

1. **Single source of truth** per fact.
2. **No cross-service direct writes.**
3. Cross-domain change = command to owner or reaction to event.
4. Owner wins over caches/projections.
5. Contact PII disclosure requires Unlock grant checked by every channel.
6. AI outputs are suggestions until accepted by domain commands.
7. Idempotency mandatory for selection, unlock payment, grant, SLA timeout, fallback.
8. Fail closed on money/PII; degrade gracefully on noncritical UX.

## Communication

- **Commands** change owned state.
- **Queries** serve read models (may be slightly stale except unlock/payment).
- **Events** fan out side effects (notifications, analytics, reputation).

## Code mapping (Sprint 0)

Logical folders: `src/domains/<service>/`  
Current implementations remain under `src/lib/*` until strangler moves ownership.  
Facades re-export only; **no behavior change in Sprint 0**.
