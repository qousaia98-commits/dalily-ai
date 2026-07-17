import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Detects whether search_logs.ranking_snapshot exists.
 * Cached per process so we do not probe on every request.
 */
let snapshotColumnAvailable: boolean | null = null;

export function resetSchemaCapabilityCache(): void {
  snapshotColumnAvailable = null;
}

export async function hasRankingSnapshotColumn(): Promise<boolean> {
  if (snapshotColumnAvailable != null) return snapshotColumnAvailable;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("search_logs").select("ranking_snapshot").limit(1);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("ranking_snapshot") || msg.includes("does not exist")) {
        snapshotColumnAvailable = false;
        console.warn(
          "[schema] search_logs.ranking_snapshot missing — apply migration 20260717120000 / 20260717130000",
        );
        return false;
      }
      // Other errors: assume column may exist, avoid locking into false
      snapshotColumnAvailable = false;
      return false;
    }

    snapshotColumnAvailable = true;
    return true;
  } catch {
    snapshotColumnAvailable = false;
    return false;
  }
}

export function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("ranking_snapshot");
}
