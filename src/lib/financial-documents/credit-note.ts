/**
 * Sprint 6 Phase 5 — Credit Note PDF for successful refunds.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { getCompanyBillingSettings } from "./company-settings";
import { allocateDocumentNumber } from "./numbering";
import { renderFinancialPdf } from "./pdf";
import {
  buildDocumentStoragePath,
  uploadDocumentPdf,
  FINANCIAL_DOCUMENTS_BUCKET,
} from "./storage";
import type { FinancialDocument } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapDoc(row: Record<string, unknown>): FinancialDocument {
  return {
    id: String(row.id),
    documentNumber: String(row.document_number),
    documentType: "refund_credit_note",
    paymentId: String(row.payment_id),
    providerId: String(row.provider_id),
    status: row.status as FinancialDocument["status"],
    currency: String(row.currency ?? "USD"),
    subtotal: Number(row.subtotal ?? 0),
    taxRate: Number(row.tax_rate ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    total: Number(row.total ?? 0),
    issueDate: String(row.issue_date),
    paymentDate: row.payment_date ? String(row.payment_date) : null,
    storagePath: row.storage_path ? String(row.storage_path) : null,
    storageBucket: String(row.storage_bucket ?? FINANCIAL_DOCUMENTS_BUCKET),
    generatedAt: String(row.generated_at),
    generatedBy: row.generated_by ? String(row.generated_by) : null,
  };
}

export async function generateCreditNoteForRefund(input: {
  refundRequestId: string;
  actorUserId?: string | null;
}): Promise<
  | { ok: true; document: FinancialDocument }
  | { ok: false; error: string }
> {
  const { data: refund } = await db()
    .from("refund_requests")
    .select("*")
    .eq("id", input.refundRequestId)
    .maybeSingle();
  if (!refund) return { ok: false, error: "refund_not_found" };
  if (refund.status !== "succeeded" && refund.financial_document_id) {
    // already has doc
  }

  if (refund.financial_document_id) {
    const { data: existing } = await db()
      .from("financial_documents")
      .select("*")
      .eq("id", refund.financial_document_id)
      .maybeSingle();
    if (existing) return { ok: true, document: mapDoc(existing) };
  }

  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("id", refund.payment_id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "payment_not_found" };

  const { data: provider } = await db()
    .from("providers")
    .select("name")
    .eq("id", refund.provider_id)
    .maybeSingle();
  const nameJson = provider?.name as { en?: string; ar?: string } | null;
  const billToName = nameJson?.en || nameJson?.ar || "Provider";

  const { data: originalDoc } = await db()
    .from("financial_documents")
    .select("id, document_number")
    .eq("payment_id", refund.payment_id)
    .in("status", ["issued", "regenerated"])
    .neq("document_type", "refund_credit_note")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const company = await getCompanyBillingSettings();
  const amount = Number(refund.refund_amount);
  const currency = String(refund.currency ?? "USD");
  const documentNumber = await allocateDocumentNumber("CRN");
  const issueDate = new Date().toISOString().slice(0, 10);

  const { data: docRow, error } = await db()
    .from("financial_documents")
    .insert({
      document_number: documentNumber,
      document_type: "refund_credit_note",
      payment_id: refund.payment_id,
      provider_id: refund.provider_id,
      status: "issued",
      currency,
      subtotal: amount,
      tax_rate: 0,
      tax_amount: 0,
      total: amount,
      issue_date: issueDate,
      payment_date: issueDate,
      generated_by: input.actorUserId ?? null,
      immutable: true,
      metadata: {
        refund_request_id: input.refundRequestId,
        reason: refund.reason,
      },
    })
    .select("*")
    .single();

  if (error || !docRow) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  await db().from("credit_note_metadata").upsert(
    {
      document_id: docRow.id,
      refund_request_id: input.refundRequestId,
      original_document_id: originalDoc?.id ?? null,
      original_document_number: originalDoc?.document_number ?? null,
      refund_amount: amount,
      currency,
      reason: refund.reason,
    },
    { onConflict: "document_id" },
  );

  const pdfBytes = await renderFinancialPdf({
    kind: "credit_note",
    documentNumber,
    issueDate,
    paymentDate: issueDate,
    company,
    billToName,
    billToCompany: billToName,
    currency,
    subtotal: amount,
    taxRate: 0,
    taxAmount: 0,
    total: amount,
    paymentReference: refund.payment_reference
      ? String(refund.payment_reference)
      : null,
    stripeReference: refund.stripe_refund_id
      ? String(refund.stripe_refund_id)
      : null,
    paymentStatus: "refunded",
    lineDescription: `Credit note — refund of ${amount} ${currency}${
      originalDoc?.document_number
        ? ` (ref ${originalDoc.document_number})`
        : ""
    }. Reason: ${refund.reason || "—"}`,
  });

  const storagePath = buildDocumentStoragePath({
    providerId: String(refund.provider_id),
    documentId: String(docRow.id),
    documentNumber,
  });
  const uploaded = await uploadDocumentPdf({ path: storagePath, bytes: pdfBytes });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const contentHash = createHash("sha256").update(pdfBytes).digest("hex");
  await db()
    .from("financial_documents")
    .update({
      storage_path: storagePath,
      content_hash: contentHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docRow.id);

  void emitAiLearningEvent({
    eventType: "credit_note_generated",
    providerId: String(refund.provider_id),
    metadata: { anonymized: true, documentNumber },
  });

  const { data: fresh } = await db()
    .from("financial_documents")
    .select("*")
    .eq("id", docRow.id)
    .single();

  return { ok: true, document: mapDoc(fresh ?? docRow) };
}

/** @deprecated use generateCreditNoteForRefund */
export async function prepareRefundCreditNote(input: {
  originalPaymentId: string;
  amount: number;
  currency: string;
  reason?: string;
  actorUserId: string;
}): Promise<
  | { ok: true; document: FinancialDocument }
  | { ok: false; error: string }
> {
  const { data: refund } = await db()
    .from("refund_requests")
    .select("id")
    .eq("payment_id", input.originalPaymentId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!refund) return { ok: false, error: "refund_not_found" };
  return generateCreditNoteForRefund({
    refundRequestId: String(refund.id),
    actorUserId: input.actorUserId,
  });
}
