/**
 * Sprint 5 Phase 2 — storage usage helpers.
 */

import { createClient } from "@/lib/supabase/server";
import { getMaxUserStorageBytes } from "@/lib/media/mime";
import type { UserStorageUsage } from "@/lib/media/types";

export async function getUserStorageUsage(userId: string): Promise<UserStorageUsage> {
  const maxBytes = getMaxUserStorageBytes();
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("user_storage_usage")
      .select("user_id, bytes_used, file_count, deleted_bytes, deleted_file_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      return {
        userId,
        bytesUsed: 0,
        fileCount: 0,
        deletedBytes: 0,
        deletedFileCount: 0,
        maxBytes,
      };
    }

    return {
      userId,
      bytesUsed: Number(data.bytes_used ?? 0),
      fileCount: Number(data.file_count ?? 0),
      deletedBytes: Number(data.deleted_bytes ?? 0),
      deletedFileCount: Number(data.deleted_file_count ?? 0),
      maxBytes,
    };
  } catch {
    return {
      userId,
      bytesUsed: 0,
      fileCount: 0,
      deletedBytes: 0,
      deletedFileCount: 0,
      maxBytes,
    };
  }
}

export async function canUploadBytes(
  userId: string,
  additionalBytes: number,
): Promise<boolean> {
  const usage = await getUserStorageUsage(userId);
  return usage.bytesUsed + additionalBytes <= usage.maxBytes;
}
