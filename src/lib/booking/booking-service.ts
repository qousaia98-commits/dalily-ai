import { createClient } from "@/lib/supabase/server";
import type {
  Booking,
  BookingDurationMinutes,
  BookingStatus,
  PreferredContact,
} from "@/lib/booking/types";

type BookingRow = Record<string, unknown>;

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id as string,
    providerId: row.provider_id as string,
    customerId: row.customer_id as string,
    serviceId: (row.service_id as string) ?? null,
    serviceRequestId: (row.service_request_id as string) ?? null,
    conversationId: (row.conversation_id as string) ?? null,
    status: row.status as BookingStatus,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    durationMinutes: Number(row.duration_minutes) as BookingDurationMinutes,
    timezone: (row.timezone as string) ?? "Asia/Damascus",
    locationText: (row.location_text as string) ?? null,
    locationLat: (row.location_lat as number) ?? null,
    locationLng: (row.location_lng as number) ?? null,
    customerNotes: (row.customer_notes as string) ?? null,
    providerNotes: (row.provider_notes as string) ?? null,
    preferredContact: (row.preferred_contact as PreferredContact) ?? null,
    requiresProviderConfirmation: row.requires_provider_confirmation !== false,
    createdAt: row.created_at as string,
    confirmedAt: (row.confirmed_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    customerConfirmedAt: (row.customer_confirmed_at as string) ?? null,
    completionPromptedAt: (row.completion_prompted_at as string) ?? null,
    issueReason: (row.issue_reason as Booking["issueReason"]) ?? null,
    issueReportedAt: (row.issue_reported_at as string) ?? null,
  };
}

export async function createBooking(input: {
  providerId: string;
  customerId: string;
  serviceId?: string | null;
  serviceRequestId?: string | null;
  conversationId?: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: BookingDurationMinutes;
  timezone?: string;
  locationText?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  customerNotes?: string | null;
  preferredContact?: PreferredContact | null;
  requiresProviderConfirmation?: boolean;
}): Promise<{ success: true; booking: Booking } | { success: false; error: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("bookings")
    .insert({
      provider_id: input.providerId,
      customer_id: input.customerId,
      service_id: input.serviceId ?? null,
      service_request_id: input.serviceRequestId ?? null,
      conversation_id: input.conversationId ?? null,
      status: "pending",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      duration_minutes: input.durationMinutes,
      timezone: input.timezone ?? "Asia/Damascus",
      location_text: input.locationText ?? null,
      location_lat: input.locationLat ?? null,
      location_lng: input.locationLng ?? null,
      customer_notes: input.customerNotes ?? null,
      preferred_contact: input.preferredContact ?? null,
      requires_provider_confirmation: input.requiresProviderConfirmation ?? true,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (String(error.message ?? "").includes("booking_overlap")) {
      return { success: false, error: "overlap" };
    }
    return { success: false, error: "create_failed" };
  }
  return { success: true, booking: mapBooking(data as BookingRow) };
}

export async function updateBookingStatus(input: {
  bookingId: string;
  status: BookingStatus;
  patch?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string; booking?: Booking }> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    ...(input.patch ?? {}),
  };
  if (input.status === "confirmed") patch.confirmed_at = new Date().toISOString();
  if (input.status === "completed" || input.status === "customer_confirmed") {
    patch.completed_at = patch.completed_at ?? new Date().toISOString();
  }
  if (input.status === "customer_confirmed") {
    patch.customer_confirmed_at = new Date().toISOString();
  }
  if (input.status === "expired") patch.expired_at = new Date().toISOString();
  if (input.status === "awaiting_customer_confirmation") {
    patch.completion_prompted_at =
      patch.completion_prompted_at ?? new Date().toISOString();
  }
  if (input.status === "issue_reported") {
    patch.issue_reported_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("bookings")
    .update(patch)
    .eq("id", input.bookingId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    if (String(error.message ?? "").includes("booking_overlap")) {
      return { success: false, error: "overlap" };
    }
    return { success: false, error: "update_failed" };
  }
  return { success: true, booking: mapBooking(data as BookingRow) };
}

export async function listProviderBookings(
  providerId: string,
  opts?: { from?: string; to?: string; status?: BookingStatus[] },
): Promise<Booking[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("bookings")
    .select("*")
    .eq("provider_id", providerId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });

  if (opts?.from) query = query.gte("starts_at", opts.from);
  if (opts?.to) query = query.lte("starts_at", opts.to);
  if (opts?.status?.length) query = query.in("status", opts.status);

  const { data } = await query;
  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

export async function listCustomerBookings(customerId: string): Promise<Booking[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("bookings")
    .select("*")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });

  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return mapBooking(data as BookingRow);
}

export async function softDeleteBooking(bookingId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bookings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", bookingId);
  return { success: !error };
}
