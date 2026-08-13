"use client";

import { useState, useTransition } from "react";
import { Download, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadFinancialDocumentAction,
  listMyFinancialDocumentsAction,
} from "@/actions/financial-documents.actions";
import type { FinancialDocument } from "@/lib/financial-documents";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

function typeLabel(
  type: string,
  t: ReturnType<typeof useTranslations<"financialDocuments">>,
): string {
  if (type === "business_subscription_invoice") return t("types.invoice");
  if (type === "lead_unlock_receipt") return t("types.leadReceipt");
  if (type === "manual_payment_receipt") return t("types.manualReceipt");
  if (type === "refund_credit_note") return t("types.creditNote");
  return type;
}

export function FinancialDocumentsPanel({
  initialDocuments,
}: {
  initialDocuments: FinancialDocument[];
}) {
  const t = useTranslations("financialDocuments");
  const locale = useLocale();
  const [documents, setDocuments] = useState(initialDocuments);
  const [type, setType] = useState<"all" | FinancialDocument["documentType"]>("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  function reload(next?: { type?: typeof type; query?: string }) {
    const documentType = next?.type ?? type;
    const q = next?.query ?? query;
    startTransition(async () => {
      const result = await listMyFinancialDocumentsAction({
        documentType,
        query: q,
      });
      if (!result.ok) {
        toast.error(t("loadError"));
        return;
      }
      setDocuments(result.documents);
    });
  }

  function download(id: string) {
    startTransition(async () => {
      const result = await downloadFinancialDocumentAction(id);
      if (!result.ok) {
        toast.error(t("downloadError"));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className="h-11 rounded-2xl border border-border bg-card px-3 text-sm"
          value={type}
          onChange={(e) => {
            const v = e.target.value as typeof type;
            setType(v);
            reload({ type: v });
          }}
          aria-label={t("filters.type")}
        >
          <option value="all">{t("filters.allTypes")}</option>
          <option value="business_subscription_invoice">{t("types.invoice")}</option>
          <option value="lead_unlock_receipt">{t("types.leadReceipt")}</option>
          <option value="manual_payment_receipt">{t("types.manualReceipt")}</option>
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") reload({ query });
            }}
            placeholder={t("searchPlaceholder")}
            className="h-11 w-full rounded-2xl border border-border bg-card pe-3 ps-10 text-sm outline-none ring-[var(--dalily-gold)]/40 focus:ring-2"
          />
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3",
                pending && "opacity-70",
              )}
            >
              <div>
                <p className="font-semibold">{doc.documentNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(doc.documentType, t)} ·{" "}
                  {formatDateTime(doc.issueDate, locale)} · {doc.total}{" "}
                  {doc.currency}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !doc.storagePath}
                onClick={() => download(doc.id)}
              >
                <Download className="me-1.5 size-3.5" />
                {t("downloadPdf")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
