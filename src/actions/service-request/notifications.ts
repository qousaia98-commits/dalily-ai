"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function sendMessageAction(
  conversationId: string,
  bodyText: string,
): Promise<{ success: boolean; error?: string }> {
  const { sendLegacyTextMessageAction } = await import("@/actions/chat.actions");
  return sendLegacyTextMessageAction(conversationId, bodyText);
}

export async function markNotificationReadAction(notificationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const supabase = await createClient();
  await supabase
    .from("marketplace_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", authUser.id);
  revalidatePath("/", "layout");
  revalidatePath("/business");
  revalidatePath("/business", "layout");
  return { success: true };
}
