# Official Engineering Migration Roadmap (Index)

**Status:** Official  
**Execution rule:** Complete each sprint’s acceptance criteria; keep app buildable; Git-revertible commits.

## Sprint sequence (do not reorder critical path)

| Sprint | Name | Complexity |
| --- | --- | --- |
| **0** | Engineering Foundation | Medium |
| 1 | Marketplace Domain | High |
| 2 | Customer Request Flow | High |
| 3 | Matching Engine | High |
| 4 | Offer System | High |
| 5 | Unlock Service | High |
| 6 | Payment Integration | High |
| 7 | Chat Authorization Migration | High |
| 8 | Provider Dashboard Migration | Medium |
| 9 | Admin Migration | Medium |
| 10 | Cleanup & Legacy Removal | High |
| 11 | Launch Readiness | Medium |

## Critical path

`S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11`

**Non-compressible integrity chain:** `S1 → S4 → S5 → S6 → S7`

## Sprint 7 scope (complete — gate)

Chat Authorization Migration:

- Flag `CHAT_AUTH_V2` (default off)
- Full chat only with `contact_release_grants` (chat scope)
- Idempotent conversation create after grant; RLS grant-aware
- Legacy in-flight backfill; public directory phone begin-hide
- Q&A remains `offer_clarifications` (pre-unlock)

See [`sprint-7-notes.md`](./sprint-7-notes.md).

**Do not implement Sprint 8 until explicit approval.**

## Sprint 6 scope (complete)

Payment Integration (Unlock Fee):

- Flag `UNLOCK_PAYMENTS_V2` (default off)
- `unlock_fee` payments linked to unlock sessions; grant only after verified capture
- Admin distinguish unlock vs subscription; subscription upgrades frozen when flag on
- Webhook ledger + manual admin rail

See [`sprint-6-notes.md`](./sprint-6-notes.md).

## Sprint 5 scope (complete)

Unlock Service — see [`sprint-5-notes.md`](./sprint-5-notes.md).

## Sprint 4 scope (complete)

Offer System — see [`sprint-4-notes.md`](./sprint-4-notes.md).

## Sprint 3 scope (complete)

Matching Engine — see [`sprint-3-notes.md`](./sprint-3-notes.md).

## Sprint 2 scope (complete)

Customer Intent Flow — see [`sprint-2-notes.md`](./sprint-2-notes.md).

## Sprint 1 scope (complete)

## Feature flags (future sprints)

Documented in planning; **not introduced as product behavior in Sprint 0**.  
When added later: default off until launch cell readiness.

## Timeline (planning estimate)

Approx. **19–30 weeks** to single-cell launch readiness with 1–2 engineers (from original roadmap). Sprint 0 is foundation only.
