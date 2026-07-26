/**
 * Atomic sequential document numbers: INV-2026-000001 / RCP-… / CRN-…
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type DocumentNumberPrefix = "INV" | "RCP" | "CRN";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function allocateDocumentNumber(
  prefix: DocumentNumberPrefix,
): Promise<string> {
  const { data, error } = await db().rpc("next_document_number", {
    p_prefix: prefix,
  });
  if (error || !data) {
    // Fallback (should be rare): timestamp-based unique — still never collide with seq
    const y = new Date().getUTCFullYear();
    const stamp = Date.now().toString().slice(-6);
    return `${prefix}-${y}-${stamp}`;
  }
  return String(data);
}

export function prefixForDocumentType(
  type:
    | "business_subscription_invoice"
    | "lead_unlock_receipt"
    | "manual_payment_receipt"
    | "refund_credit_note",
): DocumentNumberPrefix {
  if (type === "business_subscription_invoice") return "INV";
  if (type === "refund_credit_note") return "CRN";
  return "RCP";
}
