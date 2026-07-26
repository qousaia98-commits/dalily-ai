"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isPlatformAdmin } from "@/lib/auth/roles";
import {
  createDocumentSignedUrl,
  generateFinancialDocumentForPayment,
  getCompanyBillingSettings,
  getDocumentStats,
  getFinancialDocumentById,
  listFinancialDocuments,
  listMissingDocumentPayments,
  logDocumentDownload,
  updateCompanyBillingSettings,
  type CompanyBillingSettings,
  type FinancialDocument,
  type FinancialDocumentType,
} from "@/lib/financial-documents";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  isPaymentInfrastructureEnabled,
  isUnlockPaymentsV2Enabled,
  isProviderMonetizationEnabled,
} from "@/lib/config/feature-flags";

function docsEnabled(): boolean {
  return (
    isPaymentInfrastructureEnabled() ||
    isUnlockPaymentsV2Enabled() ||
    isProviderMonetizationEnabled() ||
    process.env.FINANCIAL_DOCUMENTS === "true"
  );
}

export async function listMyFinancialDocumentsAction(input?: {
  documentType?: FinancialDocumentType | "all";
  query?: string;
}): Promise<
  | { ok: true; documents: FinancialDocument[] }
  | { ok: false; error: string }
> {
  if (!docsEnabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };

  const documents = await listFinancialDocuments({
    providerId: provider.id,
    documentType: input?.documentType ?? "all",
    query: input?.query,
    limit: 200,
  });
  return { ok: true, documents };
}

export async function downloadFinancialDocumentAction(
  documentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!docsEnabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };

  const doc = await getFinancialDocumentById(documentId);
  if (!doc || !doc.storagePath) return { ok: false, error: "not_found" };

  const isAdmin = isPlatformAdmin(authUser.roles);
  if (!isAdmin) {
    const provider = await getOwnedProvider(authUser.id);
    if (!provider || provider.id !== doc.providerId) {
      return { ok: false, error: "forbidden" };
    }
  }

  const url = await createDocumentSignedUrl(doc.storagePath, 120);
  if (!url) return { ok: false, error: "download_failed" };

  await logDocumentDownload({
    documentId: doc.id,
    actorUserId: authUser.id,
    actorRole: isAdmin ? "admin" : "provider",
  });
  void emitAiLearningEvent({
    eventType: "pdf_downloaded",
    providerId: doc.providerId,
    metadata: { anonymized: true, documentNumber: doc.documentNumber },
  });
  void emitAiLearningEvent({
    eventType: "document_accessed",
    providerId: doc.providerId,
    metadata: { anonymized: true },
  });

  return { ok: true, url };
}

export async function listAdminFinancialDocumentsAction(input?: {
  documentType?: FinancialDocumentType | "all";
  query?: string;
}): Promise<
  | {
      ok: true;
      documents: FinancialDocument[];
      stats: Awaited<ReturnType<typeof getDocumentStats>>;
      missing: Awaited<ReturnType<typeof listMissingDocumentPayments>>;
    }
  | { ok: false; error: string }
> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const [documents, stats, missing] = await Promise.all([
    listFinancialDocuments({
      documentType: input?.documentType ?? "all",
      query: input?.query,
      limit: 300,
    }),
    getDocumentStats(),
    listMissingDocumentPayments(40),
  ]);
  return { ok: true, documents, stats, missing };
}

export async function regenerateFinancialDocumentAction(
  paymentId: string,
): Promise<{ ok: true; document: FinancialDocument } | { ok: false; error: string }> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const result = await generateFinancialDocumentForPayment({
    paymentId,
    actorUserId: admin.id,
    forceRegenerate: true,
  });
  if (!result.ok) return result;
  revalidatePath("/admin/documents");
  revalidatePath("/business/payments/history");
  return { ok: true, document: result.document };
}

export async function generateMissingDocumentAction(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };
  const result = await generateFinancialDocumentForPayment({
    paymentId,
    actorUserId: admin.id,
  });
  if (!result.ok) return result;
  revalidatePath("/admin/documents");
  return { ok: true };
}

export async function getCompanyBillingSettingsAction(): Promise<
  | { ok: true; settings: CompanyBillingSettings }
  | { ok: false; error: string }
> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };
  return { ok: true, settings: await getCompanyBillingSettings() };
}

export async function saveCompanyBillingSettingsAction(
  patch: Partial<Omit<CompanyBillingSettings, "id">>,
): Promise<
  | { ok: true; settings: CompanyBillingSettings }
  | { ok: false; error: string }
> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };
  const settings = await updateCompanyBillingSettings(patch, admin.id);
  revalidatePath("/admin/documents");
  revalidatePath("/admin/billing-settings");
  return { ok: true, settings };
}
