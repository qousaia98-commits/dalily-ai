/**
 * Sprint 6 Phase 4 — company billing / invoice issuer settings.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyBillingSettings } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapSettings(row: Record<string, unknown>): CompanyBillingSettings {
  return {
    id: String(row.id),
    companyName: String(row.company_name ?? "Dalily"),
    companyAddress: String(row.company_address ?? ""),
    country: String(row.country ?? ""),
    vatNumber: String(row.vat_number ?? ""),
    taxId: String(row.tax_id ?? ""),
    supportEmail: String(row.support_email ?? ""),
    website: String(row.website ?? ""),
    phone: String(row.phone ?? ""),
    invoiceFooter: String(row.invoice_footer ?? ""),
    legalNotice: String(row.legal_notice ?? ""),
    currency: String(row.currency ?? "USD"),
    defaultTaxRate: Number(row.default_tax_rate ?? 0),
    logoPath: row.logo_path ? String(row.logo_path) : null,
  };
}

export async function getCompanyBillingSettings(): Promise<CompanyBillingSettings> {
  try {
    const { data } = await db()
      .from("company_billing_settings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) return mapSettings(data);
  } catch {
    // fall through
  }
  return {
    id: "default",
    companyName: "Dalily",
    companyAddress: "",
    country: "Syria",
    vatNumber: "",
    taxId: "",
    supportEmail: "support@dalily.app",
    website: "https://dalily.app",
    phone: "",
    invoiceFooter: "Thank you for doing business with Dalily.",
    legalNotice: "",
    currency: "USD",
    defaultTaxRate: 0,
    logoPath: null,
  };
}

export async function updateCompanyBillingSettings(
  patch: Partial<Omit<CompanyBillingSettings, "id">>,
  actorUserId: string,
): Promise<CompanyBillingSettings> {
  const current = await getCompanyBillingSettings();
  const row = {
    company_name: patch.companyName ?? current.companyName,
    company_address: patch.companyAddress ?? current.companyAddress,
    country: patch.country ?? current.country,
    vat_number: patch.vatNumber ?? current.vatNumber,
    tax_id: patch.taxId ?? current.taxId,
    support_email: patch.supportEmail ?? current.supportEmail,
    website: patch.website ?? current.website,
    phone: patch.phone ?? current.phone,
    invoice_footer: patch.invoiceFooter ?? current.invoiceFooter,
    legal_notice: patch.legalNotice ?? current.legalNotice,
    currency: patch.currency ?? current.currency,
    default_tax_rate: patch.defaultTaxRate ?? current.defaultTaxRate,
    logo_path: patch.logoPath === undefined ? current.logoPath : patch.logoPath,
    updated_by: actorUserId,
    updated_at: new Date().toISOString(),
  };

  if (current.id === "default") {
    const { data } = await db()
      .from("company_billing_settings")
      .insert({ ...row, is_active: true })
      .select("*")
      .single();
    return mapSettings(data);
  }

  const { data } = await db()
    .from("company_billing_settings")
    .update(row)
    .eq("id", current.id)
    .select("*")
    .single();
  return mapSettings(data ?? row);
}
