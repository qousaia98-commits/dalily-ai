"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  MSG_READ_COOKIE,
  NEARBY_LOC_COOKIE,
  NEARBY_LOC_MAX_AGE_SEC,
  parseMsgReadCookie,
  serializeMsgReadCookie,
  serializeNearbyLocCookie,
} from "@/lib/business/message-read-state";
import { DALILY_CONVERSATION_ID, markDalilyMessagesRead } from "@/lib/dalily-messages/inbox";
import { getAuthUser } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/admin/action-log";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markConversationReadAction(
  conversationId: string,
  lastReadAt: string,
): Promise<{ success: boolean }> {
  if (!conversationId || !lastReadAt) return { success: false };

  const jar = await cookies();
  const map = parseMsgReadCookie(jar.get(MSG_READ_COOKIE)?.value);
  const prev = map[conversationId];
  if (!prev || new Date(lastReadAt).getTime() >= new Date(prev).getTime()) {
    map[conversationId] = lastReadAt;
  }

  jar.set(MSG_READ_COOKIE, serializeMsgReadCookie(map), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  if (conversationId === DALILY_CONVERSATION_ID) {
    const authUser = await getAuthUser();
    if (authUser?.id) {
      const { marked, broadcastIds } = await markDalilyMessagesRead(authUser.id);
      if (marked > 0) {
        await logAdminAction({
          actorId: authUser.id,
          action: "broadcast_opened",
          entityType: "dalily_conversation",
          entityId: DALILY_CONVERSATION_ID,
          metadata: { readCount: marked, broadcastIds },
        });
        await logAdminAction({
          actorId: authUser.id,
          action: "broadcast_read",
          entityType: "dalily_conversation",
          entityId: DALILY_CONVERSATION_ID,
          metadata: { readCount: marked, broadcastIds },
        });
        await bumpBroadcastReadCounts(broadcastIds);
      }
    }
  } else {
    // Server-side receipts when Sprint 36 migration is applied
    try {
      const { markChatReadAction } = await import("@/actions/chat.actions");
      await markChatReadAction(conversationId);
    } catch {
      /* soft — cookie unread still works */
    }
  }

  revalidatePath("/business", "layout");
  revalidatePath("/business/messages");
  revalidatePath(`/business/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  return { success: true };
}

/**
 * Best-effort: increment readCount on broadcasts the user just opened.
 */
async function bumpBroadcastReadCounts(broadcastIds: string[]): Promise<void> {
  if (broadcastIds.length === 0) return;
  try {
    const admin = createAdminClient();
    for (const broadcastId of broadcastIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await (admin as any)
        .from("admin_broadcasts")
        .select("metadata")
        .eq("id", broadcastId)
        .maybeSingle();
      const meta = (row?.metadata ?? {}) as Record<string, unknown>;
      const prev = typeof meta.readCount === "number" ? meta.readCount : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("admin_broadcasts")
        .update({ metadata: { ...meta, readCount: prev + 1 } })
        .eq("id", broadcastId);
    }
  } catch {
    /* analytics secondary */
  }
}

export async function saveNearbyLocationAction(
  lat: number,
  lng: number,
): Promise<{ success: boolean }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { success: false };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { success: false };

  const jar = await cookies();
  jar.set(
    NEARBY_LOC_COOKIE,
    serializeNearbyLocCookie({ lat, lng, at: Date.now() }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: NEARBY_LOC_MAX_AGE_SEC,
    },
  );

  revalidatePath("/search");
  return { success: true };
}

export async function clearNearbyLocationAction(): Promise<{ success: boolean }> {
  const jar = await cookies();
  jar.delete(NEARBY_LOC_COOKIE);
  revalidatePath("/search");
  return { success: true };
}
