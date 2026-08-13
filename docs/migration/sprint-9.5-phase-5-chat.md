# Sprint 9.5 Phase 5 — Chat & Messaging architecture consolidation

**Scope:** Architecture only. No conversation, realtime, notification, or API changes.

**Date:** 2026-07-28

## What changed

- Expanded `src/domains/chat` (+ `/client`, types, adapters)
- Chat Engine barrel: `src/lib/chat/index.ts`
- Thin messaging bridge: `src/lib/chat/messaging-bridge.ts`
- Legacy adapters for `lib/messaging` + `lib/dalily-messages`
- Canonical realtime re-export: `useChatRealtime` via domain client
- UI / actions redirected off deep imports
- Flags: `CHAT_ENGINE`, `MESSAGING_ENGINE`, `REALTIME_ENGINE`, `CHAT_PROVIDER`
- Docs: `docs/architecture/chat.md`

## Explicitly NOT changed

- Message / conversation SQL behaviour
- Realtime channel names / subscription logic
- Read/unread cookie behaviour
- Action return shapes

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:foundation
npm run verify:mobile
npm run verify:chat
```
