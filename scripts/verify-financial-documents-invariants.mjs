/**
 * Sprint 6 Phase 4 — financial documents invariants.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = 0;
function ok(m) {
  console.log(`✓ ${m}`);
}
function fail(m) {
  console.error(`✗ ${m}`);
  failed += 1;
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("══ Financial documents invariants ══\n");

const required = [
  "supabase/migrations/archive/20260727040000_sprint6_financial_documents.sql",
  "src/lib/financial-documents/generate.ts",
  "src/lib/financial-documents/pdf.ts",
  "src/lib/financial-documents/numbering.ts",
  "src/lib/financial-documents/company-settings.ts",
  "src/components/business/financial-documents-panel.tsx",
  "src/app/[locale]/(admin)/admin/documents/page.tsx",
];
for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const mig = read("supabase/migrations/archive/20260727040000_sprint6_financial_documents.sql");
for (const t of [
  "financial_documents",
  "invoice_metadata",
  "receipt_metadata",
  "pdf_generation_logs",
  "document_download_history",
  "company_billing_settings",
  "next_document_number",
]) {
  if (mig.includes(t)) ok(`schema has ${t}`);
  else fail(`schema missing ${t}`);
}

const gen = read("src/lib/financial-documents/generate.ts");
if (gen.includes("INV") || gen.includes("allocateDocumentNumber")) {
  ok("document numbering wired");
} else fail("numbering missing");

const capture = read("src/domains/payment/capture.ts");
const biz = read("src/lib/payment/business-subscription.ts");
if (capture.includes("ensureFinancialDocumentAfterPayment")) {
  ok("capture triggers document generation");
} else fail("capture missing doc hook");
if (biz.includes("ensureFinancialDocumentAfterPayment")) {
  ok("business subscription triggers document generation");
} else fail("business activate missing doc hook");

const pkg = JSON.parse(read("package.json"));
if (pkg.dependencies?.pdfkit) ok(`pdfkit: ${pkg.dependencies.pdfkit}`);
else fail("pdfkit missing");

console.log("");
if (failed) {
  console.error(`FAILED: ${failed}`);
  process.exit(1);
}
console.log("All financial document invariants passed.");
