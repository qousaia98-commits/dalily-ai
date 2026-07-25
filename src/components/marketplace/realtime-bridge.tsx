"use client";

import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";

export function MarketplaceRealtimeBridge({
  userId,
  conversationId,
  requestId,
  providerId,
  inboxAsCustomer,
  inboxAsProviderId,
}: {
  userId: string;
  conversationId?: string | null;
  requestId?: string | null;
  providerId?: string | null;
  inboxAsCustomer?: boolean;
  inboxAsProviderId?: string | null;
}) {
  useMarketplaceRealtime({
    userId,
    conversationId,
    requestId,
    providerId,
    inboxAsCustomer,
    inboxAsProviderId,
  });
  return null;
}
