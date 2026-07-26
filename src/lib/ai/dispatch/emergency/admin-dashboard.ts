/**
 * Admin emergency monitoring metrics.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { EmergencyAdminDashboard } from "./types";

const ACTIVE_STATUSES = [
  "detected",
  "dispatching",
  "awaiting_accept",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
];

type DispatchRow = {
  id: string;
  service_request_id: string;
  status: string;
  eta_label: string | null;
  eta_minutes_min: number | null;
  activated_at: string;
  category_slug: string | null;
  city_id: string | null;
  accepted_count: number | null;
  dispatch_duration_seconds: number | null;
};

function emergencyDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function getEmergencyAdminDashboard(): Promise<EmergencyAdminDashboard> {
  const empty: EmergencyAdminDashboard = {
    version: 3,
    activeCount: 0,
    avgResponseSeconds: null,
    avgEtaMinutes: null,
    successfulDispatchRatePct: null,
    regionalVolume: [],
    active: [],
  };

  try {
    const admin = emergencyDb();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await admin
      .from("emergency_dispatches")
      .select(
        "id, service_request_id, status, eta_label, eta_minutes_min, activated_at, category_slug, city_id, accepted_count, dispatch_duration_seconds",
      )
      .gte("activated_at", since)
      .order("activated_at", { ascending: false })
      .limit(200);

    const rows = (data ?? []) as DispatchRow[];
    if (!rows.length) return empty;

    const active = rows.filter((r) =>
      ACTIVE_STATUSES.includes(String(r.status)),
    );

    const withAccept = rows.filter((r) => Number(r.accepted_count ?? 0) > 0);
    const successfulDispatchRatePct =
      rows.length > 0
        ? Math.round((withAccept.length / rows.length) * 1000) / 10
        : null;

    const durations = rows
      .map((r) => r.dispatch_duration_seconds)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const avgResponseSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    const etas = rows
      .map((r) => r.eta_minutes_min)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const avgEtaMinutes =
      etas.length > 0
        ? Math.round(etas.reduce((a, b) => a + b, 0) / etas.length)
        : null;

    const regionMap = new Map<string, number>();
    for (const r of rows) {
      const label = r.category_slug || "unknown";
      regionMap.set(label, (regionMap.get(label) ?? 0) + 1);
    }
    const regionalVolume = [...regionMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      version: 3,
      activeCount: active.length,
      avgResponseSeconds,
      avgEtaMinutes,
      successfulDispatchRatePct,
      regionalVolume,
      active: active.slice(0, 40).map((r) => ({
        id: String(r.id),
        serviceRequestId: String(r.service_request_id),
        status: String(r.status),
        etaLabel: r.eta_label ?? null,
        activatedAt: String(r.activated_at),
        categorySlug: r.category_slug ?? null,
      })),
    };
  } catch {
    return empty;
  }
}
