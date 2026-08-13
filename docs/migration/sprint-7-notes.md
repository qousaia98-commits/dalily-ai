# Sprint 7 Notes — Chat Authorization Migration

**Status:** COMPLETE — approved; Provider Dashboard = Sprint 8  
**Feature flag:** `CHAT_AUTH_V2` (default **off**)

## Goal

Full chat (and call/contact via grant) only after a valid **Contact Release Grant**. Structured Q&A stays pre-unlock. Legacy in-flight chats preserved via grant backfill.

## Architectural decisions

1. **`CHAT_AUTH_V2` default off** — status-based `canChat()` and legacy message gates remain when unset.
2. **App + RLS dual enforcement** — `canAccessFullChat` / `assertChatParticipants` on server actions; RLS helpers `has_chat_release_grant` + `conversation_allows_message_insert` on `messages`.
3. **Lifecycle dual-run** — lifecycle ≥ 2: grant required; lifecycle < 2: grant OR legacy chat-capable status (soft-break).
4. **Q&A stays Offer domain** — `offer_clarifications`, not `conversations.thread_kind=qa` (avoids mixing channels).
5. **`thread_kind` = `legacy` | `full`** — marks grant-era threads; backfill marks grant-linked threads `full`.
6. **Idempotent session create** — `ensureFullChatSessionForGrant` after unlock success; unique `service_request_id` + 23505 race handling.
7. **Unlock still does not bind `service_requests.provider_id`** — conversation carries selected provider; only customer + that provider owner may chat.
8. **Public directory phone begin-hide** — when flag on, `getPublicProviderById` and search list mapper null phone/WhatsApp (PII only via grant contact gate).
9. **No Reviews/Notifications/Payment flow changes** except unlock success → ensure chat session when flag on.
10. **Legacy code kept** — `canChat(status)` remains for flag-off and dual-run.

## Acceptance criteria

- [x] v2 request: no full chat pre-grant
- [x] Post-grant: chat session created; UI can open chat; contact via grant
- [x] Q&A (`offer_clarifications`) works pre-grant (unchanged Offer domain)
- [x] Legacy in-flight chats preserved via `legacy_backfill` grants
- [x] AuthZ on message APIs (`assertChatParticipants` when flag on) + RLS
- [x] typecheck / lint / `verify:chat` green

## Rollback

1. Unset `CHAT_AUTH_V2`
2. Revert Sprint 7 commits if needed
3. Additive columns/functions/policies may remain; status dual-run still allows legacy lifecycle chats

## Apply DB migration

```bash
supabase db push
# 20260725230000_sprint7_chat_authorization.sql
```
