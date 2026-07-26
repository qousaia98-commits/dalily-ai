"use client";

import { useState, useTransition } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadFinancialDocumentAction,
  generateMissingDocumentAction,
  listAdminFinancialDocumentsAction,
  regenerateFinancialDocumentAction,
} from "@/actions/financial-documents.actions";
import type { FinancialDocument } from "@/lib/financial-documents";
import { formatDateTime } from "@/lib/format/datetime";

export function AdminFinancialDocumentsPanel({
  initialDocuments,
  initialStats,
  initialMissing,
}: {
  initialDocuments: FinancialDocument[];
  initialStats: {
    total: number;
    invoices: number;
    receipts: number;
    missingPaidPayments: number;
  };
  initialMissing: Array<{
    paymentId: string;
    providerId: string;
    purpose: string;
    paidAt: string | null;
  }>;
}) {
  const t = useTranslations("admin.financialDocuments");
  const locale = useLocale();
  const [documents, setDocuments] = useState(initialDocuments);
  const [stats, setStats] = useState(initialStats);
  const [missing, setMissing] = useState(initialMissing);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const result = await listAdminFinancialDocumentsAction({ query });
      if (!result.ok) {
        toast.error(t("loadError"));
        return;
      }
      setDocuments(result.documents);
      setStats(result.stats);
      setMissing(result.missing);
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t("stats.total"), String(stats.total)],
          [t("stats.invoices"), String(stats.invoices)],
          [t("stats.receipts"), String(stats.receipts)],
          [t("stats.missing"), String(stats.missingPaidPayments)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") reload();
          }}
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-2xl border border-border bg-card pe-3 ps-10 text-sm outline-none ring-[var(--dalily-gold)]/40 focus:ring-2"
        />
      </div>

      {missing.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="font-semibold">{t("missingTitle")}</h3>
          <ul className="space-y-2 text-sm">
            {missing.slice(0, 8).map((m) => (
              <li key={m.paymentId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {m.purpose} · {m.paymentId.slice(0, 8)}…
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await generateMissingDocumentAction(m.paymentId);
                      if (!result.ok) toast.error(t("generateError"));
                      else {
                        toast.success(t("generateSuccess"));
                        reload();
                      }
                    });
                  }}
                >
                  {t("generate")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 text-sm"
          >
            <div>
              <p className="font-semibold">{doc.documentNumber}</p>
              <p className="text-xs text-muted-foreground">
                {doc.documentType} · {formatDateTime(doc.issueDate, locale)} ·{" "}
                {doc.total} {doc.currency}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !doc.storagePath}
                onClick={() => {
                  startTransition(async () => {
                    const result = await downloadFinancialDocumentAction(doc.id);
                    if (!result.ok) toast.error(t("downloadError"));
                    else window.open(result.url, "_blank", "noopener,noreferrer");
                  });
                }}
              >
                <Download className="me-1 size-3.5" />
                {t("download")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await regenerateFinancialDocumentAction(
                      doc.paymentId,
                    );
                    if (!result.ok) toast.error(t("regenError"));
                    else {
                      toast.success(t("regenSuccess"));
                      reload();
                    }
                  });
                }}
              >
                <RefreshCw className="me-1 size-3.5" />
                {t("regenerate")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
