"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";

type RealtimeScope = {
  userId: string;
  providerId?: string | null;
  conversationId?: string | null;
  requestId?: string | null;
  /** Refresh inbox when any of this customer's conversations change. */
  inboxAsCustomer?: boolean;
  /** Refresh inbox when any conversation for this provider changes. */
  inboxAsProviderId?: string | null;
};

/**
 * Subscribes to marketplace realtime channels and soft-refreshes the page.
 */
export function useMarketplaceRealtime(scope: RealtimeScope) {
  const router = useRouter();

  useEffect(() => {
    if (!scope.userId) return;

    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const refresh = () => router.refresh();

    channels.push(
      supabase
        .channel(`notif-${scope.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "marketplace_notifications",
            filter: `user_id=eq.${scope.userId}`,
          },
          refresh,
        )
        .subscribe(),
    );

    if (scope.conversationId) {
      channels.push(
        supabase
          .channel(`msg-${scope.conversationId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${scope.conversationId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    if (scope.requestId) {
      channels.push(
        supabase
          .channel(`req-${scope.requestId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "service_requests",
              filter: `id=eq.${scope.requestId}`,
            },
            refresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "quotes",
              filter: `service_request_id=eq.${scope.requestId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    if (scope.providerId) {
      channels.push(
        supabase
          .channel(`provider-req-${scope.providerId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "service_requests",
              filter: `provider_id=eq.${scope.providerId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    // Inbox list: conversation.last_message_at updates when a message is inserted.
    if (scope.inboxAsCustomer) {
      channels.push(
        supabase
          .channel(`inbox-customer-${scope.userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "conversations",
              filter: `customer_id=eq.${scope.userId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    if (scope.inboxAsProviderId) {
      channels.push(
        supabase
          .channel(`inbox-provider-${scope.inboxAsProviderId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "conversations",
              filter: `provider_id=eq.${scope.inboxAsProviderId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    channels.push(
      supabase
        .channel(`customer-req-${scope.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "service_requests",
            filter: `customer_id=eq.${scope.userId}`,
          },
          refresh,
        )
        .subscribe(),
    );

    return () => {
      for (const ch of channels) {
        void supabase.removeChannel(ch);
      }
    };
  }, [
    scope.userId,
    scope.providerId,
    scope.conversationId,
    scope.requestId,
    scope.inboxAsCustomer,
    scope.inboxAsProviderId,
    router,
  ]);
}

