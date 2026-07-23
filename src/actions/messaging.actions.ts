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

  // Server-side receipts when Sprint 36 migration is applied
  try {
    const { markChatReadAction } = await import("@/actions/chat.actions");
    await markChatReadAction(conversationId);
  } catch {
    /* soft — cookie unread still works */
  }

  revalidatePath("/business", "layout");
  revalidatePath("/business/messages");
  revalidatePath(`/business/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  return { success: true };
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
