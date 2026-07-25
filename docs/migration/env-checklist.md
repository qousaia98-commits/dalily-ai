# Environment Validation Checklist

Use before local work and before declaring a sprint done.

## Required for core app boot

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for real auth/data) | Middleware can skip refresh if missing (UI-only) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (for real auth/data) | Never commit real secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only features | Never expose to client |
| `NEXT_PUBLIC_APP_URL` | Recommended | Local default `http://localhost:3000` |

## AI-assisted features

| Variable | Required when |
| --- | --- |
| `OPENAI_API_KEY` | Vision/voice/LLM search/diagnosis paths |
| `SEARCH_LLM_*` / `VISION_LLM_MODEL` | Optional overrides |

## Payments (current legacy + future unlock)

| Variable | Notes |
| --- | --- |
| `PAYMENT_PROVIDER` | Currently `manual` |
| `PAYMENT_RECEIVER` / `ACCOUNT` / `IBAN` / `SWIFT` / `BANK_NAME` | Required for real paid upgrades in prod; empty fails closed locally |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional receipt email |

## Dalily 2.0 migration flags (default off)

| Variable | Notes |
| --- | --- |
| `MARKETPLACE_DOMAIN_V2` | Sprint 1 Marketplace read-model (default off) |
| `CUSTOMER_INTENT_FLOW_V2` | Sprint 2 intent intake (default off) |
| `MATCHING_V2` | Sprint 3 Matching engine (default off) |
| `OFFERS_V2` | Sprint 4 Offer system (default off) |
| `UNLOCK_V2` | Sprint 5 Unlock sessions + grants (default off) |
| `UNLOCK_DEV_BYPASS` | Dev-only grant without payment — **never** in production |
| `UNLOCK_FEE_AMOUNT` / `UNLOCK_FEE_CURRENCY` / `UNLOCK_SLA_HOURS` | Fee/SLA snapshot defaults (5000 SYP / 24h) |
| `UNLOCK_PAYMENTS_V2` | Sprint 6 Unlock fee capture + subscription upgrade freeze (default off) |
| `PAYMENT_WEBHOOK_SECRET` | Required in production for `/api/webhooks/payments/*` |
| `PAYMENT_WEBHOOK_ALLOW_INSECURE` | Local-only when secret unset |
| `CRON_SECRET` | Optional bearer for `/api/cron/unlock-sla` |
| `CHAT_AUTH_V2` | Sprint 7 grant-gated full chat + hide public directory phone (default off) |
| `PROVIDER_DASHBOARD_V2` | Sprint 8 unlock-first provider home + why-matched (default off) |
| `ADMIN_MIGRATION_V2` | Sprint 9 cell policies, unlock ops, inspection, audited comps (default off) |

## Product flags already in repo

| Variable | Notes |
| --- | --- |
| `DALILY_CLOSED_BETA` | `true` disables public robots indexing intent |

## Sprint 0 validation steps

1. Copy `.env.example` → `.env.local` (do not commit `.env.local`).
2. Confirm example file documents all keys above.
3. Run `npm run verify:foundation`.
4. Run `npm run typecheck`.
5. Run `npm run lint`.
6. Optional smoke: `npm run dev` and open `/` (ar default).

## Secrets policy

- Never commit `.env.local` or service role keys.
- Rotate any key that appears in Git history.
