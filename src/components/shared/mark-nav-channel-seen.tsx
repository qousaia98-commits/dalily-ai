"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { markNavChannelSeenAction } from "@/actions/orders.actions";
import type { NavBadgeChannel } from "@/lib/orders/notifications";
import { runServerAction } from "@/lib/next/server-action-recovery";

/**
 * Marks marketplace notifications for a nav channel as read and soft-refreshes
 * layout badges (sidebar + mobile) without a hard reload.
 */
export function MarkNavChannelSeen({ channel }: { channel: NavBadgeChannel }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const result = await runServerAction(() => markNavChannelSeenAction(channel));
        if (result.success) {
          router.refresh();
        }
      } catch {
        // runServerAction reloads on skew; other errors leave badge until next visit
      }
    })();
  }, [channel, router]);

  return null;
}
