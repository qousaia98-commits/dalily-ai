"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import {
  markNavChannelNotificationsRead,
  type NavBadgeChannel,
} from "@/lib/orders/notifications";

function revalidateProviderNav() {
  revalidatePath("/", "layout");
  revalidatePath("/business", "layout");
  revalidatePath("/business/orders");
  revalidatePath("/business/opportunities");
  revalidatePath("/business/unlock");
  revalidatePath("/business/verification");
  revalidatePath("/account/orders");
}

export async function markOrdersSeenAction(): Promise<void> {
  const authUser = await getAuthUser();
  if (!authUser) return;
  await markNavChannelNotificationsRead(authUser.id, "orders");
  revalidateProviderNav();
}

export async function markNavChannelSeenAction(
  channel: NavBadgeChannel,
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  await markNavChannelNotificationsRead(authUser.id, channel);
  revalidateProviderNav();
  return { success: true };
}
