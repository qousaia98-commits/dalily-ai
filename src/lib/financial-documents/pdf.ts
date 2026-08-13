/**
 * Professional PDF renderer for Dalily financial documents (pdfkit).
 * Server-only — never import from Client Components.
 */

import PDFDocument from "pdfkit";
import { BRAND } from "@/lib/brand/tokens";
import type { CompanyBillingSettings } from "./types";

export type PdfDocPayload = {
  kind: "invoice" | "receipt" | "credit_note";
  documentNumber: string;
  issueDate: string;
  paymentDate?: string | null;
  company: CompanyBillingSettings;
  billToName: string;
  billToCompany?: string | null;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentReference?: string | null;
  stripeReference?: string | null;
  paymentStatus?: string | null;
  /** Invoice-specific */
  planName?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  lineDescription?: string | null;
  /** Receipt-specific */
  leadId?: string | null;
  unlockDate?: string | null;
  aiPriceUsd?: number | null;
  pricingExplanation?: string | null;
  estimatedProjectValue?: number | null;
  estimatedDurationHours?: number | null;
};

function money(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export async function renderFinancialPdf(
  payload: PdfDocPayload,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `${payload.documentNumber} — ${BRAND.name}`,
        Author: payload.company.companyName || BRAND.name,
        Subject: payload.kind,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const navy = BRAND.colors.navy;
    const gold = BRAND.colors.gold;
    const muted = BRAND.colors.textSecondary;

    // Header bar
    doc.rect(0, 0, doc.page.width, 72).fill(navy);
    doc.fillColor("#FFFFFF").fontSize(22).font("Helvetica-Bold");
    doc.text(BRAND.name, 50, 24, { continued: false });
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(gold)
      .text(BRAND.sloganEn, 50, 48);

    const title =
      payload.kind === "invoice"
        ? "INVOICE"
        : payload.kind === "credit_note"
          ? "CREDIT NOTE"
          : "RECEIPT";
    doc
      .fillColor("#FFFFFF")
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(title, 50, 28, { align: "right", width: doc.page.width - 100 });

    let y = 100;

    // Company block
    doc.fillColor(navy).fontSize(11).font("Helvetica-Bold");
    doc.text(payload.company.companyName, 50, y);
    y += 14;
    doc.fillColor(muted).fontSize(9).font("Helvetica");
    const companyLines = [
      payload.company.companyAddress,
      payload.company.country,
      payload.company.vatNumber
        ? `VAT: ${payload.company.vatNumber}`
        : null,
      payload.company.taxId ? `Tax ID: ${payload.company.taxId}` : null,
      payload.company.supportEmail,
      payload.company.website,
      payload.company.phone,
    ].filter(Boolean) as string[];
    for (const line of companyLines) {
      doc.text(line, 50, y);
      y += 12;
    }

    // Document meta (right)
    let my = 100;
    doc.fillColor(navy).fontSize(10).font("Helvetica-Bold");
    doc.text(payload.documentNumber, 320, my, { width: 220, align: "right" });
    my += 14;
    doc.fillColor(muted).font("Helvetica").fontSize(9);
    doc.text(`Issue date: ${payload.issueDate}`, 320, my, {
      width: 220,
      align: "right",
    });
    my += 12;
    if (payload.paymentDate) {
      doc.text(`Payment date: ${payload.paymentDate}`, 320, my, {
        width: 220,
        align: "right",
      });
      my += 12;
    }
    if (payload.paymentStatus) {
      doc.text(`Status: ${payload.paymentStatus}`, 320, my, {
        width: 220,
        align: "right",
      });
    }

    y = Math.max(y, my) + 24;

    // Bill to
    doc.fillColor(navy).fontSize(10).font("Helvetica-Bold");
    doc.text("Bill to", 50, y);
    y += 14;
    doc.fillColor(muted).font("Helvetica").fontSize(9);
    doc.text(payload.billToName, 50, y);
    y += 12;
    if (payload.billToCompany) {
      doc.text(payload.billToCompany, 50, y);
      y += 12;
    }

    y += 16;
    // Gold rule
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(gold).lineWidth(1.5).stroke();
    y += 16;

    // Summary table header
    doc.fillColor(navy).font("Helvetica-Bold").fontSize(9);
    doc.text("Description", 50, y);
    doc.text("Amount", 420, y, { width: 120, align: "right" });
    y += 14;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#E4E7EE").lineWidth(0.5).stroke();
    y += 10;

    doc.fillColor(muted).font("Helvetica").fontSize(9);
    const description =
      payload.lineDescription ||
      (payload.kind === "invoice"
        ? `Business subscription${payload.planName ? ` — ${payload.planName}` : ""}`
        : payload.kind === "credit_note"
          ? "Refund credit"
          : `Lead unlock${payload.leadId ? ` — ${payload.leadId}` : ""}`);
    doc.text(description, 50, y, { width: 340 });
    doc.text(money(payload.subtotal, payload.currency), 420, y, {
      width: 120,
      align: "right",
    });
    y += 28;

    if (payload.kind === "invoice" && payload.billingPeriodStart) {
      doc.text(
        `Billing period: ${payload.billingPeriodStart} → ${payload.billingPeriodEnd ?? "—"}`,
        50,
        y,
        { width: 340 },
      );
      y += 14;
    }

    if (payload.kind === "receipt") {
      const extras = [
        payload.unlockDate ? `Unlock date: ${payload.unlockDate}` : null,
        payload.aiPriceUsd != null
          ? `AI price: ${money(payload.aiPriceUsd, "USD")}`
          : null,
        payload.estimatedProjectValue != null
          ? `Est. project value: ${money(payload.estimatedProjectValue, "USD")}`
          : null,
        payload.estimatedDurationHours != null
          ? `Est. duration: ${payload.estimatedDurationHours}h`
          : null,
        payload.pricingExplanation
          ? `Pricing: ${payload.pricingExplanation}`
          : null,
      ].filter(Boolean) as string[];
      for (const line of extras) {
        doc.text(line, 50, y, { width: 480 });
        y += 12;
      }
      y += 8;
    }

    // Totals
    y += 8;
    doc.moveTo(320, y).lineTo(doc.page.width - 50, y).strokeColor("#E4E7EE").stroke();
    y += 10;
    doc.fillColor(muted).fontSize(9);
    doc.text("Subtotal", 320, y);
    doc.text(money(payload.subtotal, payload.currency), 420, y, {
      width: 120,
      align: "right",
    });
    y += 14;
    doc.text(`VAT (${(payload.taxRate * 100).toFixed(1)}%)`, 320, y);
    doc.text(money(payload.taxAmount, payload.currency), 420, y, {
      width: 120,
      align: "right",
    });
    y += 16;
    doc.fillColor(navy).font("Helvetica-Bold").fontSize(11);
    doc.text("Total", 320, y);
    doc.text(money(payload.total, payload.currency), 420, y, {
      width: 120,
      align: "right",
    });
    y += 28;

    // References
    doc.fillColor(muted).font("Helvetica").fontSize(9);
    if (payload.paymentReference) {
      doc.text(`Payment reference: ${payload.paymentReference}`, 50, y);
      y += 12;
    }
    if (payload.stripeReference) {
      doc.text(`Stripe reference: ${payload.stripeReference}`, 50, y);
      y += 12;
    }

    // Footer
    const footerY = doc.page.height - 90;
    doc
      .moveTo(50, footerY)
      .lineTo(doc.page.width - 50, footerY)
      .strokeColor(gold)
      .lineWidth(1)
      .stroke();
    doc.fillColor(muted).fontSize(8).font("Helvetica");
    doc.text(payload.company.invoiceFooter || "", 50, footerY + 10, {
      width: doc.page.width - 100,
    });
    if (payload.company.legalNotice) {
      doc.text(payload.company.legalNotice, 50, footerY + 28, {
        width: doc.page.width - 100,
      });
    }
    doc
      .fillColor(gold)
      .text(
        `${BRAND.name} · ${payload.company.website || "dalily.app"}`,
        50,
        doc.page.height - 40,
        { align: "center", width: doc.page.width - 100 },
      );

    doc.end();
  });
}
