/**
 * System event helpers — posts via existing post_system_message RPC.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CommunicationSystemEvent } from "./types";

const BODY_KEYS: Record<CommunicationSystemEvent, string> = {
  offer_received: "Offer received",
  offer_accepted: "Offer accepted",
  booking_confirmed: "Booking confirmed",
  booking_cancelled: "Booking cancelled",
  provider_arrived: "Provider arrived",
  job_started: "Job started",
  job_completed: "Job completed",
  review_requested: "Review requested",
  payment_initiated: "Payment initiated",
  payment_authorized: "Payment authorized",
  payment_reserved: "Funds reserved in escrow",
  payment_released: "Escrow released",
  payment_refunded: "Payment refunded",
  payment_completed: "Payment completed",
  dispute_opened: "Dispute opened",
  chat_opened: "Private conversation opened",
  contact_unlocked: "Contact unlocked — you can coordinate here",
};

export async function postCommunicationSystemEvent(input: {
  conversationId: string;
  actorId: string;
  event: CommunicationSystemEvent;
  body?: string;
  useAdmin?: boolean;
}): Promise<{ ok: boolean }> {
  try {
    const client = input.useAdmin
      ? createAdminClient()
      : await createClient();
    await client.rpc("post_system_message", {
      p_conversation_id: input.conversationId,
      p_actor_id: input.actorId,
      p_body: input.body ?? BODY_KEYS[input.event],
      p_event_type: input.event,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
