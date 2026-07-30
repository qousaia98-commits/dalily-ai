# RC2.1 — Security, Payment Authorization & Incident Response

Closed Beta gate documentation for P0 remediations.

## Cron security (fail-closed)

- All `/api/cron/*` routes use `assertCronAuthorized` (`src/lib/security/cron-auth.ts`).
- `CRON_SECRET` **must** be set in every deployed environment.
- Missing secret → **HTTP 500** + security log (`cron_secret_missing`). Cron logic does **not** run.
- Invalid / missing `Authorization: Bearer <token>` → **HTTP 401**.
- Comparison uses `crypto.timingSafeEqual` (no string `===` on secrets).

## Role matrix

| Capability | user | business | moderator | support | finance | admin (super) |
| --- | --- | --- | --- | --- | --- | --- |
| Admin panel access | | | ✓ | ✓ | ✓ | ✓ |
| Moderate content / reports / listings / chat review | | | ✓ | ✓ | | ✓ |
| Suspend users (existing admin flows) | | | ✓* | ✓* | | ✓ |
| Wallet credit / debit | | | | | ✓ | ✓ |
| Escrow release / refund | | | | | ✓ | ✓ |
| Payout process / retry | | | | | ✓ | ✓ |
| View others’ financial reports / invoices (unscoped) | | | | | ✓ | ✓ |
| Open escrow dispute (party) | ✓ (customer) | ✓ (provider owner) | | | ✓ | ✓ |
| Own wallet / own payouts | ✓ | ✓ | | | | ✓ |

\* Subject to existing admin action gates; financial mutations are **not** available to moderators.

Helpers: `canManageFinance`, `canModerateContent`, `isPlatformAdmin`, `canAccessAdminPanel` in `src/lib/auth/roles.ts`.

## Payment architecture (money rails)

```
Customer funds
  → Payment intent / capture (orchestration + state machine)
  → Escrow reserve (optional wallet reserve)
  → Release → Provider payout
     OR Refund → Clear reserve + credit (wallet) / refund credit
```

**Invariant:** Escrow never both **releases to provider** and **refunds** for the same hold. Terminal money paths are mutually exclusive (`canTransitionEscrowStatus`).

### Wallet atomicity

- Mutations call RPC `apply_wallet_ledger_entry` (row `FOR UPDATE`, ledger insert, balance update in one transaction).
- Idempotency key unique per wallet; replays return current balances.
- Application path: `applyWalletLedgerEntry` in `src/domains/payment/wallet/service.ts`.

### Escrow refund metadata

- `metadata` is **merged**, never replaced wholesale.
- `fundedVia` is preserved so wallet reserves are released before refund credit.

### Payment status machine

- `src/lib/payment/state-machine.ts` + CAS update in `transitionPaymentStatus`.
- Invalid / duplicate-from-other-status transitions are rejected; same-status is idempotent.

## Authorization (no IDOR)

Every payment / escrow / refund lookup validates:

1. Authenticated session
2. Ownership (customer / provider owner) **or**
3. `canManageFinance`

APIs: `/api/payments/transactions`, `/status`, `/invoices`, `/payouts`.

## Financial audit logging

Table `financial_audit_logs` (append-only; no UPDATE/DELETE for `authenticated`):

| Field | Purpose |
| --- | --- |
| created_at | Timestamp |
| actor_id / actor_roles | Actor + role snapshot |
| action | Operation code |
| object_type / object_id | Target |
| old_state / new_state | Before / after |
| ip / correlation_id | Request correlation |
| result | success \| failure \| rejected |

Writer: `logFinancialAudit` (`src/domains/payment/audit.ts`).

## Incident response (Closed Beta)

1. **Suspected cron abuse** — rotate `CRON_SECRET`; confirm logs show `unauthorized_cron` / `cron_secret_missing`; redeploy.
2. **Wallet imbalance** — freeze wallet (`status=frozen`); reconcile `wallet_ledger` vs balances; never delete ledger rows.
3. **Escrow double-credit** — check `financial_audit_logs` for `escrow_refund` + ledger idempotency keys; reverse with finance-only adjustment + audit.
4. **IDOR report** — revoke sessions; verify ownership helpers; add regression to `scripts/test-rc21-p0.mjs` / e2e payment smoke.
5. **Privilege escalation (moderator → money)** — confirm `requireFinanceUser` on enterprise payment actions; remove erroneous `finance` role grants.

## CI gates

See `.github/workflows/ci.yml` and `docs/architecture/verify.md`.
