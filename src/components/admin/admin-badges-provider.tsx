"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import {
  markAdminChannelSeenAction,
  ensureAdminBadgeBaselinesAction,
} from "@/actions/admin-badge.actions";
import {
  resolveAdminBadgeChannel,
  type AdminBadgeChannel,
  type AdminNavBadgeCounts,
} from "@/lib/admin/badge-ack";
import { zeroChannel } from "@/lib/admin/nav-badges-client";

type AdminBadgesContextValue = {
  badges: AdminNavBadgeCounts;
  acknowledgeChannel: (channel: AdminBadgeChannel) => void;
};

const AdminBadgesContext = createContext<AdminBadgesContextValue | null>(null);

export function AdminBadgesProvider({
  initialBadges,
  children,
}: {
  initialBadges: AdminNavBadgeCounts;
  children: ReactNode;
}) {
  const [badges, setBadges] = useState(initialBadges);
  const pathname = usePathname();
  const router = useRouter();
  const lastAckKey = useRef<string | null>(null);
  const ackInFlight = useRef<Set<string>>(new Set());

  const acknowledgeChannel = useCallback(
    (channel: AdminBadgeChannel) => {
      if (ackInFlight.current.has(channel)) return;
      ackInFlight.current.add(channel);
      setBadges((prev) => zeroChannel(prev, channel));
      void (async () => {
        try {
          const result = await markAdminChannelSeenAction(channel);
          if (result.success) router.refresh();
        } finally {
          ackInFlight.current.delete(channel);
        }
      })();
    },
    [router],
  );

  useEffect(() => {
    setBadges(initialBadges);
  }, [initialBadges]);

  useEffect(() => {
    void ensureAdminBadgeBaselinesAction();
  }, []);

  // Visit page → acknowledge that module's unread
  useEffect(() => {
    const channel = resolveAdminBadgeChannel(pathname);
    if (!channel) return;
    const key = `nav:${pathname}:${channel}`;
    if (lastAckKey.current === key) return;
    lastAckKey.current = key;
    acknowledgeChannel(channel);
  }, [pathname, acknowledgeChannel]);

  // New items while already on the page (realtime refresh) → acknowledge again
  useEffect(() => {
    const channel = resolveAdminBadgeChannel(pathname);
    if (!channel) return;
    if ((initialBadges[channel] ?? 0) <= 0) return;
    acknowledgeChannel(channel);
  }, [initialBadges, pathname, acknowledgeChannel]);

  const value = useMemo(
    () => ({ badges, acknowledgeChannel }),
    [badges, acknowledgeChannel],
  );

  return <AdminBadgesContext.Provider value={value}>{children}</AdminBadgesContext.Provider>;
}

export function useAdminBadges(): AdminBadgesContextValue {
  const ctx = useContext(AdminBadgesContext);
  if (!ctx) {
    return {
      badges: {},
      acknowledgeChannel: () => undefined,
    };
  }
  return ctx;
}
