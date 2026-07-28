# Chat & Messaging Architecture

Sprint 9.5 Phase 5 — architecture consolidation only.  
Conversations, realtime, notifications, and API responses are unchanged.

## Architecture

```
UI / Pages / Actions
        ↓
src/domains/chat              ← sole public entry (server)
src/domains/chat/client       ← client-safe (formatters, Dalily constants, useChatRealtime)
        ↓
src/lib/chat                  ← Chat Engine
src/lib/chat/messaging-bridge ← thin Messaging Bridge
        ↓
src/lib/messaging             ← legacy inbox list helpers (adapter)
src/lib/dalily-messages       ← legacy official thread (adapter)
        ↓
src/hooks/use-chat-realtime   ← canonical Realtime Layer
        ↓
Database (conversations, messages, typing, presence)
```

## Public API

**Server:**

```ts
import {
  assertChatParticipants,
  canAccessFullChat,
  insertTextMessage,
  getOrCreateConversationForRequest,
  markConversationReadServer,
  loadConversationsForCustomer,
  listDalilyInboxMessages,
} from "@/domains/chat";
```

**Client:**

```ts
import {
  useChatRealtime,
  formatConversationListTime,
  DALILY_CONVERSATION_ID,
  OFFICIAL_ACCOUNTS,
} from "@/domains/chat/client";
```

## Conversation Flow

1. Unlock grant → `ensureFullChatSessionForGrant`
2. Actions gate via `assertChatParticipants` / `isChatEngineEnabled`
3. Engine: insert / edit / pin / attachments / read / typing / presence
4. Realtime: `useChatRealtime` subscribes to messages, typing, peer presence

## Realtime Flow

Single client wrapper: `src/hooks/use-chat-realtime.ts`  
Re-exported only via `@/domains/chat/client`.  
Marketplace inbox refresh remains `useMarketplaceRealtime` (marketplace domain, not chat threads).

## Messaging Bridge

`src/lib/chat/messaging-bridge.ts` — façade metadata, flag pointers, future providers.  
No conversation business logic.

## Legacy Adapters / shared leaf modules

| Host | Adapter | Notes |
|------|---------|-------|
| `lib/messaging` | `adapters/messaging.ts` | Server inbox queries + formatters |
| `lib/dalily-messages` | `adapters/dalily.ts` | Official thread (inbox is server-only) |

**Client-shared modules** (`lib/business/conversations`, etc.) must import
client-safe leaves (`format-conversation-time`, `official-account`, `message-meta`)
directly — never the `@/domains/chat` server barrel (pulls `next/headers`).

## Feature Flags

| Canonical | Legacy aliases |
|-----------|----------------|
| `CHAT_ENGINE` | `CHAT_AUTH_V2` |
| `MESSAGING_ENGINE` | falls back to `CHAT_ENGINE` |
| `REALTIME_ENGINE` | `REALTIME_CHAT`, `REALTIME_CHAT_V1` |
| `CHAT_PROVIDER` | `MESSAGING_PROVIDER` (default `supabase`) |

## Allowed / Forbidden Imports

| From | May import |
|------|------------|
| UI / actions / pages (server) | `@/domains/chat` |
| `"use client"` UI | `@/domains/chat/client` |
| Domain adapters | `lib/chat`, messaging, dalily-messages, hooks |

| From | Must not import |
|------|-----------------|
| UI / actions / pages | `@/lib/chat/**`, `@/lib/messaging/**`, `@/lib/dalily-messages/**`, `@/hooks/use-chat-realtime` |

## File classification

| Path | Class |
|------|--------|
| `domains/chat/*` | Public API |
| `lib/chat/*` | Engine |
| `lib/chat/messaging-bridge.ts` | Bridge |
| `hooks/use-chat-realtime.ts` | Realtime |
| `lib/messaging/*` | Legacy |
| `lib/dalily-messages/*` | Legacy |
| `domains/chat/adapters/*` | Adapter |
| `lib/chat/types.ts` | Types |
