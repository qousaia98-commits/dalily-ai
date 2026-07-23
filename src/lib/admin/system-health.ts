/**
 * System Health — operational signals for Admin Control Center.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type SystemHealthSnapshot = {
  databaseStatus: "ok" | "degraded" | "down";
  realtimeStatus: "ok" | "unknown";
  storageUsageLabel: string;
  queueStatus: "idle" | "unknown";
  apiHealth: "ok" | "degraded";
  cronJobs: Array<{ name: string; status: string }>;
  recentErrors: Array<{ message: string; at: string }>;
  deploymentVersion: string;
  environment: string;
};

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const admin = createAdminClient();
  let databaseStatus: SystemHealthSnapshot["databaseStatus"] = "ok";

  try {
    const { error } = await admin.from("users").select("id", { head: true, count: "exact" }).limit(1);
    if (error) databaseStatus = "degraded";
  } catch {
    databaseStatus = "down";
  }

  return {
    databaseStatus,
    realtimeStatus: "unknown",
    storageUsageLabel: "n/a",
    queueStatus: "unknown",
    apiHealth: databaseStatus === "ok" ? "ok" : "degraded",
    cronJobs: [
      { name: "booking-completion", status: "configured" },
      { name: "subscription-expiry", status: "configured" },
    ],
    recentErrors: [],
    deploymentVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? "local",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  };
}
