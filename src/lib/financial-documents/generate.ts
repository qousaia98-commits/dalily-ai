/**
 * Sprint 6 Phase 4 — generate financial documents after successful payment.
 * Called from capture / business-subscription activation — never from UI directly
 * (except admin regenerate).
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { getCompanyBillingSettings } from "./company-settings";
import { allocateDocumentNumber, prefixForDocumentType } from "./numbering";
import { renderFinancialPdf } from "./pdf";
import {
  buildDocumentStoragePath,
  uploadDocumentPdf,
  FINANCIAL_DOCUMENTS_BUCKET,
} from "./storage";
import type {
  FinancialDocument,
  FinancialDocumentType,
} from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapDoc(row: Record<string, unknown>): FinancialDocument {
  return {
    id: String(row.id),
    documentNumber: String(row.document_number),
    documentType: row.document_type as FinancialDocumentType,
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

function resolveDocumentType(purpose: string): FinancialDocumentType {
  if (purpose === "business_subscription") {
    return "business_subscription_invoice";
  }
  if (purpose === "unlock_fee" || purpose === "lead_unlock") {
    return "lead_unlock_receipt";
  }
  return "manual_payment_receipt";
}

async function logPdf(input: {
  documentId?: string | null;
  paymentId?: string | null;
  action: "generate" | "regenerate" | "fail";
  success: boolean;
  errorMessage?: string | null;
  actorUserId?: string | null;
  durationMs?: number;
  payload?: Record<string, unknown>;
}) {
  try {
    await db().from("pdf_generation_logs").insert({
      document_id: input.documentId ?? null,
      payment_id: input.paymentId ?? null,
      action: input.action,
      success: input.success,
      error_message: input.errorMessage ?? null,
      actor_user_id: input.actorUserId ?? null,
      duration_ms: input.durationMs ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // soft
  }
}

function providerDisplayName(name: unknown): string {
  if (!name) return "Provider";
  if (typeof name === "string") return name;
  const n = name as { en?: string; ar?: string };
  return n.en || n.ar || "Provider";
}

/**
 * Idempotent: returns existing issued document for payment+type if present.
 */
export async function generateFinancialDocumentForPayment(input: {
  paymentId: string;
  actorUserId?: string | null;
  forceRegenerate?: boolean;
}): Promise<
  | { ok: true; document: FinancialDocument; reused: boolean }
  | { ok: false; error: string }
> {
  const started = Date.now();
  try {
    const { data: payment } = await db()
      .from("payments")
      .select("*")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (!payment) return { ok: false, error: "payment_not_found" };
    if (payment.payment_status !== "paid") {
      return { ok: false, error: "payment_not_paid" };
    }

    const documentType = resolveDocumentType(String(payment.purpose ?? "subscription"));

    if (!input.forceRegenerate) {
      const { data: existing } = await db()
        .from("financial_documents")
        .select("*")
        .eq("payment_id", input.paymentId)
        .eq("document_type", documentType)
        .in("status", ["issued", "regenerated"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.storage_path) {
        return { ok: true, document: mapDoc(existing), reused: true };
      }
    }

    const company = await getCompanyBillingSettings();
    const { data: provider } = await db()
      .from("providers")
      .select("id, name, email, phone")
      .eq("id", payment.provider_id)
      .maybeSingle();

    const billToName = providerDisplayName(provider?.name);
    const amount = Number(payment.amount ?? 0);
    const currency = String(payment.currency ?? company.currency ?? "USD");
    const taxRate = Number(company.defaultTaxRate ?? 0);
    const taxAmount = Math.round(amount * taxRate * 100) / 100;
    const total = Math.round((amount + taxAmount) * 100) / 100;
    const issueDate = new Date().toISOString().slice(0, 10);
    const paymentDate = payment.paid_at
      ? String(payment.paid_at).slice(0, 10)
      : issueDate;

    const prefix = prefixForDocumentType(documentType);
    const documentNumber = await allocateDocumentNumber(prefix);

    // Void previous if regenerating
    if (input.forceRegenerate) {
      await db()
        .from("financial_documents")
        .update({ status: "void", updated_at: new Date().toISOString() })
        .eq("payment_id", input.paymentId)
        .eq("document_type", documentType)
        .in("status", ["issued", "regenerated"]);
    }

    const { data: docRow, error: insertError } = await db()
      .from("financial_documents")
      .insert({
        document_number: documentNumber,
        document_type: documentType,
        payment_id: input.paymentId,
        provider_id: payment.provider_id,
        status: input.forceRegenerate ? "regenerated" : "issued",
        currency,
        subtotal: amount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        issue_date: issueDate,
        payment_date: paymentDate,
        generated_by: input.actorUserId ?? null,
        immutable: true,
        metadata: { purpose: payment.purpose },
      })
      .select("*")
      .single();

    if (insertError || !docRow) {
      await logPdf({
        paymentId: input.paymentId,
        action: input.forceRegenerate ? "regenerate" : "generate",
        success: false,
        errorMessage: insertError?.message ?? "insert_failed",
        actorUserId: input.actorUserId,
        durationMs: Date.now() - started,
      });
      return { ok: false, error: insertError?.message ?? "insert_failed" };
    }

    const documentId = String(docRow.id);

    // Metadata
    let planName: string | null = "Business";
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    let leadId: string | null = null;
    let unlockSessionId: string | null = null;
    let unlockDate: string | null = null;
    let aiPrice: number | null = null;
    let pricingExplanation: string | null = null;
    let estValue: number | null = null;
    let estHours: number | null = null;
    const stripePi: string | null =
      payment.stripe_payment_intent_id
        ? String(payment.stripe_payment_intent_id)
        : payment.stripe_checkout_session_id
          ? String(payment.stripe_checkout_session_id)
          : payment.provider_reference
            ? String(payment.provider_reference)
            : null;

    if (documentType === "business_subscription_invoice") {
      const { data: subPay } = await db()
        .from("business_subscription_payments")
        .select("*")
        .eq("payment_id", input.paymentId)
        .maybeSingle();
      periodStart = subPay?.period_start
        ? String(subPay.period_start)
        : null;
      periodEnd = subPay?.period_end ? String(subPay.period_end) : null;
      planName = subPay?.renewal ? "Business (renewal)" : "Business";

      await db().from("invoice_metadata").upsert(
        {
          document_id: documentId,
          provider_name: billToName,
          provider_company: billToName,
          subscription_plan: planName,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          payment_reference: payment.payment_reference,
          stripe_reference: stripePi,
          payment_status: payment.payment_status,
          line_description: `Dalily Business plan — ${planName}`,
        },
        { onConflict: "document_id" },
      );
    } else {
      const { data: lead } = await db()
        .from("lead_unlock_payments")
        .select("*")
        .eq("payment_id", input.paymentId)
        .maybeSingle();

      unlockSessionId = lead?.unlock_session_id
        ? String(lead.unlock_session_id)
        : payment.unlock_session_id
          ? String(payment.unlock_session_id)
          : null;
      leadId = lead?.service_request_id
        ? String(lead.service_request_id)
        : unlockSessionId;
      unlockDate = lead?.unlocked_at
        ? String(lead.unlocked_at)
        : payment.paid_at
          ? String(payment.paid_at)
          : null;
      aiPrice =
        lead?.ai_price_usd != null ? Number(lead.ai_price_usd) : amount;

      if (unlockSessionId) {
        try {
          const { data: session } = await db()
            .from("unlock_sessions")
            .select("ai_price_usd, pricing_history_id, service_request_id")
            .eq("id", unlockSessionId)
            .maybeSingle();
          if (session?.service_request_id) {
            leadId = String(session.service_request_id);
          }
          if (session?.pricing_history_id) {
            const { data: hist } = await db()
              .from("lead_pricing_history")
              .select("explanation_en, estimated_project_value_usd, estimated_duration_hours")
              .eq("id", session.pricing_history_id)
              .maybeSingle();
            pricingExplanation = hist?.explanation_en
              ? String(hist.explanation_en)
              : null;
            estValue =
              hist?.estimated_project_value_usd != null
                ? Number(hist.estimated_project_value_usd)
                : null;
            estHours =
              hist?.estimated_duration_hours != null
                ? Number(hist.estimated_duration_hours)
                : null;
          }
        } catch {
          // soft — pricing history optional
        }
      }

      await db().from("receipt_metadata").upsert(
        {
          document_id: documentId,
          lead_id: leadId,
          unlock_session_id: unlockSessionId,
          unlock_date: unlockDate,
          ai_price_usd: aiPrice,
          pricing_explanation: pricingExplanation,
          estimated_project_value: estValue,
          estimated_duration_hours: estHours,
          provider_name: billToName,
          payment_reference: payment.payment_reference,
          stripe_payment_intent: stripePi,
        },
        { onConflict: "document_id" },
      );
    }

    const kind =
      documentType === "business_subscription_invoice"
        ? "invoice"
        : documentType === "refund_credit_note"
          ? "credit_note"
          : "receipt";

    const pdfBytes = await renderFinancialPdf({
      kind,
      documentNumber,
      issueDate,
      paymentDate,
      company,
      billToName,
      billToCompany: billToName,
      currency,
      subtotal: amount,
      taxRate,
      taxAmount,
      total,
      paymentReference: payment.payment_reference
        ? String(payment.payment_reference)
        : null,
      stripeReference: stripePi,
      paymentStatus: String(payment.payment_status),
      planName,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      lineDescription:
        documentType === "business_subscription_invoice"
          ? `Dalily Business plan — ${planName}`
          : documentType === "lead_unlock_receipt"
            ? `Lead unlock${leadId ? ` (${leadId})` : ""}`
            : "Manual payment receipt",
      leadId,
      unlockDate,
      aiPriceUsd: aiPrice,
      pricingExplanation,
      estimatedProjectValue: estValue,
      estimatedDurationHours: estHours,
    });

    const storagePath = buildDocumentStoragePath({
      providerId: String(payment.provider_id),
      documentId,
      documentNumber,
    });
    const uploaded = await uploadDocumentPdf({
      path: storagePath,
      bytes: pdfBytes,
    });
    if (!uploaded.ok) {
      await logPdf({
        documentId,
        paymentId: input.paymentId,
        action: "fail",
        success: false,
        errorMessage: uploaded.error,
        actorUserId: input.actorUserId,
        durationMs: Date.now() - started,
      });
      void emitAiLearningEvent({
        eventType: "pdf_generation_failed",
        providerId: String(payment.provider_id),
        metadata: { anonymized: true, paymentId: input.paymentId },
      });
      return { ok: false, error: uploaded.error };
    }

    const contentHash = createHash("sha256").update(pdfBytes).digest("hex");
    await db()
      .from("financial_documents")
      .update({
        storage_path: storagePath,
        storage_bucket: FINANCIAL_DOCUMENTS_BUCKET,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // Keep legacy invoices table in sync for business invoices
    if (documentType === "business_subscription_invoice") {
      try {
        await db().from("invoices").upsert(
          {
            provider_id: payment.provider_id,
            payment_id: input.paymentId,
            invoice_number: documentNumber,
            subtotal: amount,
            total,
            currency,
            status: "paid",
          },
          { onConflict: "payment_id" },
        );
      } catch {
        // legacy table may lack unique on payment_id — soft
        try {
          await db().from("invoices").insert({
            provider_id: payment.provider_id,
            payment_id: input.paymentId,
            invoice_number: documentNumber,
            subtotal: amount,
            total,
            currency,
            status: "paid",
          });
        } catch {
          // ignore
        }
      }
    }

    await logPdf({
      documentId,
      paymentId: input.paymentId,
      action: input.forceRegenerate ? "regenerate" : "generate",
      success: true,
      actorUserId: input.actorUserId,
      durationMs: Date.now() - started,
    });

    void emitAiLearningEvent({
      eventType:
        documentType === "business_subscription_invoice"
          ? input.forceRegenerate
            ? "pdf_regenerated"
            : "invoice_generated"
          : input.forceRegenerate
            ? "pdf_regenerated"
            : "receipt_generated",
      providerId: String(payment.provider_id),
      metadata: {
        anonymized: true,
        documentNumber,
        documentType,
      },
    });

    const { data: fresh } = await db()
      .from("financial_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    return {
      ok: true,
      document: mapDoc(fresh ?? docRow),
      reused: false,
    };
  } catch (e) {
    await logPdf({
      paymentId: input.paymentId,
      action: "fail",
      success: false,
      errorMessage: e instanceof Error ? e.message : "generate_failed",
      actorUserId: input.actorUserId,
      durationMs: Date.now() - started,
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "generate_failed",
    };
  }
}

/**
 * Fire-and-forget safe wrapper for payment success hooks.
 */
export async function ensureFinancialDocumentAfterPayment(input: {
  paymentId: string;
  actorUserId?: string | null;
}): Promise<void> {
  try {
    await generateFinancialDocumentForPayment(input);
  } catch {
    // never block payment success
  }
}

export async function listFinancialDocuments(input: {
  providerId?: string | null;
  documentType?: FinancialDocumentType | "all";
  query?: string;
  limit?: number;
}): Promise<FinancialDocument[]> {
  try {
    let q = db()
      .from("financial_documents")
      .select("*")
      .in("status", ["issued", "regenerated"])
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);
    if (input.providerId) q = q.eq("provider_id", input.providerId);
    if (input.documentType && input.documentType !== "all") {
      q = q.eq("document_type", input.documentType);
    }
    const { data } = await q;
    let rows = (data ?? []).map(mapDoc);
    if (input.query?.trim()) {
      const needle = input.query.trim().toLowerCase();
      rows = rows.filter(
        (d: FinancialDocument) =>
          d.documentNumber.toLowerCase().includes(needle) ||
          d.paymentId.toLowerCase().includes(needle),
      );
    }
    return rows;
  } catch {
    return [];
  }
}

export async function getFinancialDocumentById(
  documentId: string,
): Promise<FinancialDocument | null> {
  try {
    const { data } = await db()
      .from("financial_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();
    return data ? mapDoc(data) : null;
  } catch {
    return null;
  }
}

export async function getDocumentStats(): Promise<{
  total: number;
  invoices: number;
  receipts: number;
  missingPaidPayments: number;
}> {
  try {
    const { data: docs } = await db()
      .from("financial_documents")
      .select("document_type")
      .in("status", ["issued", "regenerated"])
      .limit(5000);
    const rows = docs ?? [];
    const invoices = rows.filter(
      (r: { document_type: string }) =>
        r.document_type === "business_subscription_invoice",
    ).length;
    const receipts = rows.filter(
      (r: { document_type: string }) =>
        r.document_type === "lead_unlock_receipt" ||
        r.document_type === "manual_payment_receipt",
    ).length;

    const { data: paid } = await db()
      .from("payments")
      .select("id")
      .eq("payment_status", "paid")
      .limit(5000);
    const paidIds = new Set((paid ?? []).map((p: { id: string }) => p.id));
    const { data: linked } = await db()
      .from("financial_documents")
      .select("payment_id")
      .in("status", ["issued", "regenerated"])
      .limit(5000);
    const linkedIds = new Set(
      (linked ?? []).map((d: { payment_id: string }) => d.payment_id),
    );
    let missing = 0;
    for (const id of paidIds) {
      if (!linkedIds.has(id)) missing += 1;
    }

    return {
      total: rows.length,
      invoices,
      receipts,
      missingPaidPayments: missing,
    };
  } catch {
    return { total: 0, invoices: 0, receipts: 0, missingPaidPayments: 0 };
  }
}

export async function listMissingDocumentPayments(limit = 50): Promise<
  Array<{ paymentId: string; providerId: string; purpose: string; paidAt: string | null }>
> {
  try {
    const { data: paid } = await db()
      .from("payments")
      .select("id, provider_id, purpose, paid_at")
      .eq("payment_status", "paid")
      .order("paid_at", { ascending: false })
      .limit(500);
    const { data: docs } = await db()
      .from("financial_documents")
      .select("payment_id")
      .in("status", ["issued", "regenerated"])
      .limit(2000);
    const linked = new Set(
      (docs ?? []).map((d: { payment_id: string }) => d.payment_id),
    );
    return (paid ?? [])
      .filter((p: { id: string }) => !linked.has(p.id))
      .slice(0, limit)
      .map((p: {
        id: string;
        provider_id: string;
        purpose: string;
        paid_at: string | null;
      }) => ({
        paymentId: p.id,
        providerId: p.provider_id,
        purpose: p.purpose,
        paidAt: p.paid_at,
      }));
  } catch {
    return [];
  }
}
