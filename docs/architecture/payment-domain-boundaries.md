# Payment: `src/lib/payment` vs `src/domains/payment`

**Status:** Informational — clarifies an existing, intentional split (see `domain-map.md`, payment row: "Active", both locations). Not a defect, not scheduled for consolidation.

## Why two directories

`src/lib/payment` is the payment **rails** layer: talks to Stripe, owns the payment status state machine, canonical types, webhook signature verification and event handling. It doesn't know about escrow, wallets, or marketplace concepts.

`src/domains/payment` is the **marketplace money layer**: escrow holds, provider wallets/payouts, unlock-fee calculation, refunds, invoices, financial audit logging. It calls into `src/lib/payment` for the underlying payment intent / state transitions rather than talking to Stripe directly.

This mirrors the same "domains build marketplace behavior on top of lib rails" pattern already used for `matching`, `offer`, `unlock`, `chat`, and `admin` (see `domain-map.md`) — payment is not a special case, just the largest instance of it.

## Rough file map

| Concern | Owner |
| --- | --- |
| Stripe integration, webhook verification | `src/lib/payment/stripe/*`, `src/lib/payment/providers/stripe.provider.ts` |
| Payment status state machine (CAS transitions) | `src/lib/payment/state-machine.ts` |
| Canonical payment types, orchestration | `src/lib/payment/canonical-types.ts`, `orchestration.ts` |
| Legacy business subscription billing | `src/lib/payment/business-subscription.ts` (kept — see `docs/migration/legacy-inventory.md`) |
| Escrow holds / release / refund | `src/domains/payment/escrow/*` |
| Provider wallet + ledger | `src/domains/payment/wallet/*` |
| Payouts to providers | `src/domains/payment/payouts/*` |
| Unlock-fee calculation | `src/domains/payment/fees/*`, `unlock-fee.ts` |
| Financial audit log | `src/domains/payment/audit.ts` |
| Webhook idempotency ledger | `src/domains/payment/webhook-ledger.ts` |

## Rule

New marketplace-money features go in `src/domains/payment`. New payment-rail/provider integrations go in `src/lib/payment`. Don't reimplement Stripe calls or state-machine transitions inside `src/domains/payment` — call the `src/lib/payment` primitives.
