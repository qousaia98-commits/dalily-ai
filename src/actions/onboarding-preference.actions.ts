"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/session";
import {
  ONBOARDING_CARD_DISMISS_COOKIE,
  ONBOARDING_DEFER_COOKIE,
  ONBOARDING_DEFER_MAX_AGE_SEC,
  ONBOARDING_REMINDER_DISMISS_COOKIE,
  serializeTimestampCookie,
} from "@/lib/business/onboarding-preference";

async function setDismissCookie(name: string, maxAgeSec: number) {
  const jar = await cookies();
  jar.set(name, serializeTimestampCookie(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });
}

/** “Later” — close forced welcome for this session and open the dashboard. */
export async function deferOnboardingAction(): Promise<{ success: boolean }> {
  await requireAuthUser();
  await setDismissCookie(ONBOARDING_DEFER_COOKIE, ONBOARDING_DEFER_MAX_AGE_SEC);
  revalidatePath("/business", "layout");
  revalidatePath("/business/welcome");
  return { success: true };
}

/** Hide dashboard onboarding card for several days. */
export async function dismissOnboardingCardAction(): Promise<{ success: boolean }> {
  await requireAuthUser();
  await setDismissCookie(ONBOARDING_CARD_DISMISS_COOKIE, 60 * 60 * 24 * 30);
  revalidatePath("/business");
  return { success: true };
}

/** Soft-dismiss reminder emphasis for several days. */
export async function dismissOnboardingReminderAction(): Promise<{ success: boolean }> {
  await requireAuthUser();
  await setDismissCookie(ONBOARDING_REMINDER_DISMISS_COOKIE, 60 * 60 * 24 * 30);
  revalidatePath("/business");
  return { success: true };
}
