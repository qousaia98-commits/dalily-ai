# Payment Engine V2 (archived)

## What this was

An enterprise “V2” payment orchestration layer (`initializePayment`, authorize /
capture / escrow reserve-release / refund / cancel / retry) built for Sprint 10
Phase 4. It sat behind `isPaymentsV2Enabled()` and delegated to existing
adapters, escrow, fees, and refund helpers — never calling PSP SDKs directly.

## Why it was archived (2026-07-31)

As of RC2.1 the module was **built but never wired**: no call sites under `src/`
invoked it; it only appeared as barrel re-exports from `@/domains/payment` and
`@/domains/payment/refunds`. Keeping an unwired money path in the live domain
risked accidental imports and confused ownership.

This archive is a **deliberate** decision (not automated dead-code cleanup).

## Location

- Source snapshot: [`payment-engine.ts`](./payment-engine.ts)
- Former path: `src/domains/payment/engine/payment-engine.ts`

## How to revive

1. Move or copy `payment-engine.ts` back under `src/domains/payment/engine/`.
2. Re-export the public functions from `src/domains/payment/index.ts` (and
   `refunds/index.ts` if `refundPayment` should stay on that facade).
3. Wire real marketplace / escrow flows to call the engine (not only re-export).
4. Run `npm run typecheck`, `npm run test`, and `npm run verify:payments`.
5. Add focused unit/integration coverage before enabling `PAYMENTS_V2` in prod.

## Alternative

If the product no longer needs this orchestration layer, delete this archive
after an explicit money-path review — do not silently remove live wallet/escrow
code that *is* wired.
