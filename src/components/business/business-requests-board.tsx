"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";
import {
  BUSINESS_REQUEST_TABS,
  statusesForTab,
  type BusinessRequestTab,
} from "@/lib/service-requests/status-machine";
import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";

type Props = {
  requests: ServiceRequestDetail[];
  badges: Record<BusinessRequestTab, number>;
  userId: string;
  providerId: string;
};

export function BusinessRequestsBoard({ requests, badges, userId, providerId }: Props) {
  const t = useTranslations("business.requests");
  const [tab, setTab] = useState<BusinessRequestTab>("pending");
  const [query, setQuery] = useState("");

  useMarketplaceRealtime({ userId, providerId });

  const filtered = useMemo(() => {
    const statuses = statusesForTab(tab);
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => statuses.includes(r.status))
      .filter((r) => {
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      });
  }, [requests, tab, query]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-11 rounded-2xl ps-9"
        />
      </div>

      <div
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label={t("listLabel")}
      >
        {BUSINESS_REQUEST_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            id={`request-tab-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)] focus-visible:ring-offset-2",
              tab === key
                ? "bg-[var(--dalily-navy)] text-white"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${key}`)}
            {badges[key] > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--dalily-navy)]">
                {badges[key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((request) => (
            <li key={request.id}>
              <Link
                href={`/business/requests/${request.id}`}
                className="block rounded-2xl border border-border bg-card p-4 transition hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">{request.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("fromCustomer", { name: request.customerName })}
                    </p>
                  </div>
                  <Badge variant="secondary">{t(`status.${request.status}`)}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {request.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(request.created_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
