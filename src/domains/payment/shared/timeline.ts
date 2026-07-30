/**
 * Payment → communication timeline bridge (Sprint 10 Phase 3 + 4).
 */

import { postCommunicationSystemEvent } from "@/domains/chat/communication/system-events";
import type { CommunicationSystemEvent } from "@/domains/chat/communication/types";

export type PaymentTimelineEvent =
  | "payment_initiated"
  | "payment_authorized"
  | "payment_reserved"
  | "payment_released"
  | "payment_refunded"
  | "payment_completed"
  | "dispute_opened";

const BODY: Record<PaymentTimelineEvent, string> = {
  payment_initiated: "Payment initiated",
  payment_authorized: "Payment authorized",
  payment_reserved: "Funds reserved in escrow",
  payment_released: "Escrow released",
  payment_refunded: "Payment refunded",
  payment_completed: "Payment completed",
  dispute_opened: "Payment dispute opened",
};

/** Map fine-grained payment events onto chat system event_type (varchar). */
function toSystemEvent(event: PaymentTimelineEvent): CommunicationSystemEvent {
  switch (event) {
    case "dispute_opened":
      return "dispute_opened";
    case "payment_refunded":
      return "payment_refunded";
    case "payment_initiated":
      return "payment_initiated";
    case "payment_authorized":
      return "payment_authorized";
    case "payment_reserved":
      return "payment_reserved";
    case "payment_released":
      return "payment_released";
    case "payment_completed":
    default:
      return "payment_completed";
  }
}

export async function emitPaymentTimelineEvent(input: {
  conversationId: string | null | undefined;
  actorId: string;
  event: PaymentTimelineEvent;
  body?: string;
}): Promise<void> {
  if (!input.conversationId) return;
  await postCommunicationSystemEvent({
    conversationId: input.conversationId,
    actorId: input.actorId,
    event: toSystemEvent(input.event),
    body: input.body ?? BODY[input.event],
    useAdmin: true,
  });
}
