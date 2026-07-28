"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { markNavChannelSeenAction } from "@/actions/orders.actions";
import type { NavBadgeChannel } from "@/lib/orders/notifications";
import { runServerAction } from "@/lib/next/server-action-recovery";

/**
 * Marks marketplace notifications for a nav channel as read and soft-refreshes
 * layout badges (sidebar + mobile) without a hard reload.
 *
 * Persist: marketplace_notifications.read_at (per channel type set).
 * Independent channels: orders | opportunities | unlock | verification.
 */
export function MarkNavChannelSeen({ channel }: { channel: NavBadgeChannel }) {
  const router = useRouter();
  const ranFor = useRef<NavBadgeChannel | null>(null);

  useEffect(() => {
    if (ranFor.current === channel) return;
    ranFor.current = channel;

    void (async () => {
      try {
        const result = await runServerAction(() => markNavChannelSeenAction(channel));
        if (result.success) {
          router.refresh();
        } else {
          ranFor.current = null;
        }
      } catch {
        ranFor.current = null;
        // runServerAction reloads on skew; other errors retry on next visit
      }
    })();
  }, [channel, router]);

  return null;
}
