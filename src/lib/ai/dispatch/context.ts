import { createAdminClient } from "@/lib/supabase/admin";
import {
  isNowWithinHours,
  workingMinutesFromHours,
} from "@/lib/ai/dispatch/capacity";
import type { ProviderDispatchProfile } from "@/lib/ai/dispatch/types";

/**
 * Load operational context for a provider batch (geo, hours, today's bookings).
 * Best-effort — missing tables never break matching.
 */
export async function loadProviderDispatchProfiles(
  providerIds: string[],
): Promise<Map<string, ProviderDispatchProfile>> {
  const map = new Map<string, ProviderDispatchProfile>();
  if (providerIds.length === 0) return map;

  try {
    const admin = createAdminClient();
    const { data: providers } = await admin
      .from("providers")
      .select(
        "id, owner_id, latitude, longitude, verification_status, rating_avg, review_count",
      )
      .in("id", providerIds);

    const { data: settings } = await admin
      .from("provider_request_settings")
      .select(
        "provider_id, accepting_requests, handles_emergency, estimated_response_hours, vacation_mode",
      )
      .in("provider_id", providerIds);

    const settingsMap = new Map(
      (settings ?? []).map((s) => [s.provider_id as string, s]),
    );

    const dow = new Date().getDay(); // 0=Sun
    let hoursRows: Array<{
      provider_id: string;
      opens_at: string | null;
      closes_at: string | null;
      is_closed: boolean;
    }> = [];
    try {
      const { data } = await admin
        .from("provider_working_hours")
        .select("provider_id, opens_at, closes_at, is_closed")
        .in("provider_id", providerIds)
        .eq("day_of_week", dow);
      hoursRows = (data as typeof hoursRows) ?? [];
    } catch {
      hoursRows = [];
    }
    const hoursMap = new Map(hoursRows.map((h) => [h.provider_id, h]));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let bookingRows: Array<{
      id: string;
      provider_id: string;
      starts_at: string;
      ends_at: string;
      location_lat: number | null;
      location_lng: number | null;
      status: string;
    }> = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bookingsClient = admin as any;
      const { data, error } = await bookingsClient
        .from("bookings")
        .select(
          "id, provider_id, starts_at, ends_at, location_lat, location_lng, status",
        )
        .in("provider_id", providerIds)
        .gte("starts_at", startOfDay.toISOString())
        .lte("starts_at", endOfDay.toISOString())
        .in("status", [
          "pending",
          "confirmed",
          "customer_confirmed",
          "awaiting_customer_confirmation",
        ]);
      if (!error && Array.isArray(data)) {
        bookingRows = data as typeof bookingRows;
      }
    } catch {
      bookingRows = [];
    }

    const bookingsByProvider = new Map<string, typeof bookingRows>();
    for (const b of bookingRows) {
      const list = bookingsByProvider.get(b.provider_id) ?? [];
      list.push(b);
      bookingsByProvider.set(b.provider_id, list);
    }

    for (const p of providers ?? []) {
      const id = p.id as string;
      const s = settingsMap.get(id);
      const h = hoursMap.get(id);
      const accepting = s ? Boolean(s.accepting_requests) && !s.vacation_mode : true;
      const handlesEmergency =
        s?.handles_emergency === undefined || s?.handles_emergency === null
          ? true
          : Boolean(s.handles_emergency);
      const workingMinutes = h
        ? workingMinutesFromHours({
            opensAt: h.opens_at,
            closesAt: h.closes_at,
            isClosed: Boolean(h.is_closed),
          })
        : 8 * 60; // default full day if hours unknown
      const within = h
        ? isNowWithinHours({
            opensAt: h.opens_at,
            closesAt: h.closes_at,
            isClosed: Boolean(h.is_closed),
          })
        : true;

      const today = (bookingsByProvider.get(id) ?? []).map((b) => ({
        id: b.id,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        lat: b.location_lat,
        lng: b.location_lng,
      }));

      map.set(id, {
        providerId: id,
        ownerId: p.owner_id as string,
        lat: p.latitude == null ? null : Number(p.latitude),
        lng: p.longitude == null ? null : Number(p.longitude),
        verificationStatus: String(p.verification_status),
        ratingAvg: Number(p.rating_avg ?? 0),
        reviewCount: Number(p.review_count ?? 0),
        acceptingRequests: accepting,
        handlesEmergency,
        estimatedResponseHours:
          s?.estimated_response_hours == null
            ? null
            : Number(s.estimated_response_hours),
        todayBookings: today,
        workingMinutesToday: workingMinutes,
        isWithinWorkingHours: within,
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[dispatch.profiles]", error);
    }
  }

  return map;
}

/** Resolve request anchor coordinates from city (requests lack lat/lng). */
export async function resolveRequestAnchor(input: {
  cityId: string | null;
}): Promise<{ lat: number | null; lng: number | null }> {
  if (!input.cityId) return { lat: null, lng: null };
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("cities")
      .select("latitude, longitude")
      .eq("id", input.cityId)
      .maybeSingle();
    if (!data) return { lat: null, lng: null };
    return {
      lat: data.latitude == null ? null : Number(data.latitude),
      lng: data.longitude == null ? null : Number(data.longitude),
    };
  } catch {
    return { lat: null, lng: null };
  }
}
