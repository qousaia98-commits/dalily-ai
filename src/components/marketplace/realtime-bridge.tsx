"use client";

import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";

export function MarketplaceRealtimeBridge({
  userId,
  conversationId,
  requestId,
  providerId,
}: {
  userId: string;
  conversationId?: string | null;
  requestId?: string | null;
  providerId?: string | null;
}) {
  useMarketplaceRealtime({ userId, conversationId, requestId, providerId });
  return null;
}
