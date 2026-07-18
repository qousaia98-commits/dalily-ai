"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  NEARBY_LOC_COOKIE,
  NEARBY_LOC_MAX_AGE_SEC,
  serializeNearbyLocCookie,
} from "@/lib/business/message-read-state";
import {
  LOC_PREF_COOKIE,
  type LocationPreference,
} from "@/lib/geo/location-preference";

async function setPreference(pref: LocationPreference) {
  const jar = await cookies();
  jar.set(LOC_PREF_COOKIE, pref, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
}

function revalidateLocationPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/search");
  revalidatePath("/account");
}

export async function enableLocationWithCoordsAction(
  lat: number,
  lng: number,
): Promise<{ success: boolean }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { success: false };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { success: false };

  const jar = await cookies();
  await setPreference("enabled");
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

  revalidateLocationPaths();
  return { success: true };
}

export async function declineLocationAction(): Promise<{ success: boolean }> {
  const jar = await cookies();
  await setPreference("disabled");
  jar.delete(NEARBY_LOC_COOKIE);
  revalidateLocationPaths();
  return { success: true };
}

export async function disableLocationAction(): Promise<{ success: boolean }> {
  return declineLocationAction();
}

export async function refreshNearbyLocationAction(
  lat: number,
  lng: number,
): Promise<{ success: boolean }> {
  const jar = await cookies();
  const pref = jar.get(LOC_PREF_COOKIE)?.value;
  if (pref !== "enabled") return { success: false };
  return enableLocationWithCoordsAction(lat, lng);
}
