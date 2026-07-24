"use client";

import type { ReactNode } from "react";
import { AdminBadgesProvider } from "@/components/admin/admin-badges-provider";
import { AdminBadgeRealtime } from "@/components/admin/admin-badge-realtime";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import type { AdminNavBadgeCounts } from "@/lib/admin/badge-ack";

export function AdminControlShell({
  badges,
  showAdminOnly,
  children,
}: {
  badges: AdminNavBadgeCounts;
  showAdminOnly: boolean;
  children: ReactNode;
}) {
  return (
    <AdminBadgesProvider initialBadges={badges}>
      <div className="contents">
        <AdminBadgeRealtime />
        <AdminSidebar showAdminOnly={showAdminOnly} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AdminBadgesProvider>
  );
}
