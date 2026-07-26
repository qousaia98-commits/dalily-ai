/**
 * Sprint 5 Phase 5 — project activity feed helpers.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CollabActivityEvent } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function logProjectActivity(input: {
  projectId: string;
  packageId?: string | null;
  eventKey: string;
  labelEn: string;
  labelAr: string;
  actor?: CollabActivityEvent["actor"];
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db().from("project_activity_events").insert({
      project_id: input.projectId,
      package_id: input.packageId ?? null,
      event_key: input.eventKey,
      label_en: input.labelEn,
      label_ar: input.labelAr,
      actor: input.actor ?? "system",
      actor_user_id: input.actorUserId ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // best-effort
  }
}

export async function listProjectActivity(
  projectId: string,
  limit = 60,
): Promise<CollabActivityEvent[]> {
  try {
    const { data } = await db()
      .from("project_activity_events")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map(
      (row: Record<string, unknown>): CollabActivityEvent => ({
        id: String(row.id),
        projectId: String(row.project_id),
        packageId: row.package_id ? String(row.package_id) : null,
        eventKey: String(row.event_key),
        labelEn: String(row.label_en),
        labelAr: String(row.label_ar),
        actor: row.actor as CollabActivityEvent["actor"],
        createdAt: String(row.created_at),
        payload: (row.payload as Record<string, unknown>) ?? {},
      }),
    );
  } catch {
    return [];
  }
}
