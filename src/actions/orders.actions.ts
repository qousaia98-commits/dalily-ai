"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { markOrderNotificationsRead } from "@/lib/orders/notifications";

export async function markOrdersSeenAction(): Promise<void> {
  const authUser = await getAuthUser();
  if (!authUser) return;
  await markOrderNotificationsRead(authUser.id);
  revalidatePath("/", "layout");
  revalidatePath("/business", "layout");
  revalidatePath("/account/orders");
  revalidatePath("/business/orders");
}
