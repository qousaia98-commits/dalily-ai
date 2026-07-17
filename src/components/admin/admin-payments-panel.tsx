"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { getLocalizedField } from "@/types/provider.types";
import { AdminPaymentsTable } from "@/components/admin/admin-payments-table";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  providerName: { ar: string; en: string };
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  planSlug: string;
  amount: number;
  currency: string;
  paymentReference: string;
  receiptPath: string | null;
  createdAt: string;
  paymentStatus: string;
};

type TabKey = "pending_review" | "paid" | "rejected" | "all";

function asTab(value: string | undefined): TabKey {
  if (value === "pending_review" || value === "paid" || value === "rejected" || value === "all") {
    return value;
  }
  return "pending_review";
}

export function AdminPaymentsPanel({
  payments,
  counts,
  initialTab,
}: {
  payments: PaymentRow[];
  counts: Record<string, number>;
  initialTab?: string;
}) {
  const t = useTranslations("admin.payments");
  const locale = useLocale();
  const [tab, setTab] = useState<TabKey>(asTab(initialTab));
  const [query, setQuery] = useState("");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "pending_review", label: t("tabs.pendingReview"), count: counts.pending_review ?? 0 },
    { key: "paid", label: t("tabs.approved"), count: counts.paid ?? 0 },
    { key: "rejected", label: t("tabs.rejected"), count: counts.rejected ?? 0 },
    { key: "all", label: t("tabs.all"), count: counts.all ?? 0 },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((payment) => {
      if (tab !== "all" && payment.paymentStatus !== tab) return false;
      if (!q) return true;
      const company = getLocalizedField(payment.providerName, locale).toLowerCase();
      const haystack = [
        company,
        payment.ownerName ?? "",
        payment.ownerEmail ?? "",
        payment.phone ?? "",
        payment.paymentReference,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [payments, tab, query, locale]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-2xl border px-3.5 py-2 text-sm font-semibold transition",
              tab === item.key
                ? "border-[var(--dalily-navy)] bg-[var(--dalily-navy)] text-white"
                : "border-[#E8ECF2] bg-white text-[var(--dalily-navy)] hover:bg-muted/40",
            )}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-12 w-full rounded-2xl border border-[#E8ECF2] bg-white pe-4 ps-10 text-sm shadow-sm outline-none ring-[var(--dalily-gold)]/40 focus:ring-2"
        />
      </div>

      <AdminPaymentsTable payments={filtered} />
    </div>
  );
}
