import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentEventType = "requested" | "receipt_uploaded" | "approved" | "rejected";

export async function logPaymentEvent(params: {
  paymentId: string;
  eventType: PaymentEventType;
  actorId?: string | null;
  note?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("payment_events").insert({
    payment_id: params.paymentId,
    event_type: params.eventType,
    actor_id: params.actorId ?? null,
    note: params.note?.trim() || null,
  });
}

export async function listPaymentEvents(paymentId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_events")
    .select("id, event_type, actor_id, note, created_at")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: true });

  const actorIds = [...new Set((data ?? []).map((e) => e.actor_id).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", actorIds);
    for (const p of profiles ?? []) {
      if (p.display_name) nameById.set(p.user_id, p.display_name);
    }
  }

  return (data ?? []).map((event) => ({
    id: event.id,
    eventType: event.event_type as PaymentEventType,
    actorId: event.actor_id,
    actorName: event.actor_id ? (nameById.get(event.actor_id) ?? null) : null,
    note: event.note,
    createdAt: event.created_at,
  }));
}
