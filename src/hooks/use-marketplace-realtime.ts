"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type BrowserSupabase = ReturnType<typeof createClient>;

type RealtimeScope = {
  userId: string;
  providerId?: string | null;
  conversationId?: string | null;
  requestId?: string | null;
  /** Refresh inbox when any of this customer's conversations change. */
  inboxAsCustomer?: boolean;
  /** Refresh inbox when any conversation for this provider changes. */
  inboxAsProviderId?: string | null;
  /** Also listen for marketplace spine tables on this request (offers/selection/unlock). */
  marketplaceSpine?: boolean;
};

type PostgresConfig = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema: "public";
  table: string;
  filter?: string;
};

type ActiveSub = {
  channel: RealtimeChannel;
  refCount: number;
  listeners: Set<() => void>;
};

/** One live subscription per scope fingerprint — prevents duplicate .on() after subscribe(). */
const activeByKey = new Map<string, ActiveSub>();

function scopeKey(scope: RealtimeScope): string {
  return [
    scope.userId,
    scope.providerId ?? "",
    scope.conversationId ?? "",
    scope.requestId ?? "",
    scope.inboxAsCustomer ? "1" : "0",
    scope.inboxAsProviderId ?? "",
    scope.marketplaceSpine === false ? "0" : "1",
  ].join("|");
}

function collectBindings(scope: RealtimeScope): PostgresConfig[] {
  const bindings: PostgresConfig[] = [
    {
      event: "*",
      schema: "public",
      table: "marketplace_notifications",
      filter: `user_id=eq.${scope.userId}`,
    },
    {
      event: "*",
      schema: "public",
      table: "service_requests",
      filter: `customer_id=eq.${scope.userId}`,
    },
  ];

  if (scope.conversationId) {
    bindings.push({
      event: "*",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${scope.conversationId}`,
    });
  }

  if (scope.requestId) {
    bindings.push(
      {
        event: "UPDATE",
        schema: "public",
        table: "service_requests",
        filter: `id=eq.${scope.requestId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "quotes",
        filter: `service_request_id=eq.${scope.requestId}`,
      },
    );

    if (scope.marketplaceSpine !== false) {
      bindings.push(
        {
          event: "*",
          schema: "public",
          table: "marketplace_offers",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "marketplace_selections",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "match_assignments",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "emergency_dispatches",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "emergency_timeline_events",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "emergency_live_locations",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "unlock_sessions",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "contact_release_grants",
          filter: `service_request_id=eq.${scope.requestId}`,
        },
      );
    }
  }

  if (scope.providerId) {
    bindings.push(
      {
        event: "*",
        schema: "public",
        table: "service_requests",
        filter: `provider_id=eq.${scope.providerId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "match_assignments",
        filter: `provider_id=eq.${scope.providerId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "marketplace_offers",
        filter: `provider_id=eq.${scope.providerId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "marketplace_selections",
        filter: `provider_id=eq.${scope.providerId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "unlock_sessions",
        filter: `provider_id=eq.${scope.providerId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "contact_release_grants",
        filter: `provider_id=eq.${scope.providerId}`,
      },
    );
  }

  if (scope.inboxAsCustomer) {
    bindings.push({
      event: "*",
      schema: "public",
      table: "conversations",
      filter: `customer_id=eq.${scope.userId}`,
    });
  }

  if (scope.inboxAsProviderId) {
    bindings.push({
      event: "*",
      schema: "public",
      table: "conversations",
      filter: `provider_id=eq.${scope.inboxAsProviderId}`,
    });
  }

  return bindings;
}

function createScopedChannel(
  supabase: BrowserSupabase,
  key: string,
  scope: RealtimeScope,
  onEvent: () => void,
): RealtimeChannel {
  // Single channel topic — never reuse short names like `notif-${userId}` across mounts.
  let channel = supabase.channel(`dalily-mp:${key}`);

  for (const binding of collectBindings(scope)) {
    channel = channel.on("postgres_changes", binding, onEvent);
  }

  // subscribe() ONLY after every .on() is registered
  channel.subscribe();
  return channel;
}

/**
 * Subscribes to marketplace realtime and soft-refreshes the page.
 * Exactly one Supabase channel per scope; duplicate mounts ref-count the same sub.
 */
export function useMarketplaceRealtime(scope: RealtimeScope) {
  const router = useRouter();
  const refreshRef = useRef(() => {
    router.refresh();
  });
  refreshRef.current = () => {
    router.refresh();
  };

  const userId = scope.userId;
  const providerId = scope.providerId ?? null;
  const conversationId = scope.conversationId ?? null;
  const requestId = scope.requestId ?? null;
  const inboxAsCustomer = Boolean(scope.inboxAsCustomer);
  const inboxAsProviderId = scope.inboxAsProviderId ?? null;
  const marketplaceSpine = scope.marketplaceSpine !== false;

  useEffect(() => {
    if (!userId) return;

    const resolved: RealtimeScope = {
      userId,
      providerId,
      conversationId,
      requestId,
      inboxAsCustomer,
      inboxAsProviderId,
      marketplaceSpine,
    };
    const key = scopeKey(resolved);
    const listener = () => refreshRef.current();

    const existing = activeByKey.get(key);
    if (existing) {
      existing.refCount += 1;
      existing.listeners.add(listener);
      return () => {
        existing.listeners.delete(listener);
        existing.refCount -= 1;
        if (existing.refCount <= 0) {
          activeByKey.delete(key);
          const supabase = createClient();
          void supabase.removeChannel(existing.channel);
        }
      };
    }

    const supabase = createClient();
    const fanOut = () => {
      const entry = activeByKey.get(key);
      if (!entry) return;
      for (const fn of entry.listeners) fn();
    };

    const channel = createScopedChannel(supabase, key, resolved, fanOut);
    const entry: ActiveSub = {
      channel,
      refCount: 1,
      listeners: new Set([listener]),
    };
    activeByKey.set(key, entry);

    return () => {
      entry.listeners.delete(listener);
      entry.refCount -= 1;
      if (entry.refCount <= 0) {
        activeByKey.delete(key);
        void supabase.removeChannel(channel);
      }
    };
  }, [
    userId,
    providerId,
    conversationId,
    requestId,
    inboxAsCustomer,
    inboxAsProviderId,
    marketplaceSpine,
  ]);
}
