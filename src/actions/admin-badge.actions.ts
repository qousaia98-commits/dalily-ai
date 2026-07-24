"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_SEEN_COOKIE,
  isAdminBadgeChannel,
  parseAdminSeenCookie,
  serializeAdminSeenCookie,
  type AdminBadgeChannel,
} from "@/lib/admin/badge-ack";

export async function markAdminChannelSeenAction(
  channel: string,
): Promise<{ success: boolean; seenAt?: string }> {
  const authUser = await requireAdminUser();
  if (!isAdminBadgeChannel(channel)) return { success: false };

  const seenAt = new Date().toISOString();
  const jar = await cookies();
  const map = parseAdminSeenCookie(jar.get(ADMIN_SEEN_COOKIE)?.value);
  map[channel] = seenAt;

  jar.set(ADMIN_SEEN_COOKIE, serializeAdminSeenCookie(map), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Messages channel also clears marketplace notification unread (existing read_at system)
  if (channel === "messages") {
    const supabase = await createClient();
    await supabase
      .from("marketplace_notifications")
      .update({ read_at: seenAt })
      .eq("user_id", authUser.id)
      .is("read_at", null);
  }

  revalidatePath("/admin", "layout");
  return { success: true, seenAt };
}

export async function markAdminChannelsSeenAction(
  channels: AdminBadgeChannel[],
): Promise<{ success: boolean }> {
  await requireAdminUser();
  const seenAt = new Date().toISOString();
  const jar = await cookies();
  const map = parseAdminSeenCookie(jar.get(ADMIN_SEEN_COOKIE)?.value);
  for (const channel of channels) {
    if (isAdminBadgeChannel(channel)) map[channel] = seenAt;
  }
  jar.set(ADMIN_SEEN_COOKIE, serializeAdminSeenCookie(map), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
  return { success: true };
}

/** Baseline watermarks on first Control Center visit so audit/broadcasts don't explode. */
export async function ensureAdminBadgeBaselinesAction(): Promise<{ success: boolean }> {
  await requireAdminUser();
  const jar = await cookies();
  const map = parseAdminSeenCookie(jar.get(ADMIN_SEEN_COOKIE)?.value);
  const seenAt = new Date().toISOString();
  let changed = false;
  for (const channel of ["audit", "broadcasts"] as const) {
    if (!map[channel]) {
      map[channel] = seenAt;
      changed = true;
    }
  }
  if (!changed) return { success: true };
  jar.set(ADMIN_SEEN_COOKIE, serializeAdminSeenCookie(map), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
  return { success: true };
}

/** Explicit open of a single marketplace notification (reuse existing column). */
export async function markAdminNotificationReadAction(
  notificationId: string,
): Promise<{ success: boolean }> {
  const authUser = await requireAdminUser();
  const admin = createAdminClient();
  await admin
    .from("marketplace_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", authUser.id);
  revalidatePath("/admin", "layout");
  return { success: true };
}
