"use client";

import dynamic from "next/dynamic";

/**
 * Sprint 5.5 — lazy-load heavy notification center (keeps header bundle small).
 */
export const NotificationCenterBellLazy = dynamic(
  () =>
    import("@/components/notifications/notification-center-bell").then(
      (m) => m.NotificationCenterBell,
    ),
  {
    ssr: false,
    loading: () => (
      <span
        className="inline-flex size-9 items-center justify-center rounded-md"
        aria-hidden
      />
    ),
  },
);
