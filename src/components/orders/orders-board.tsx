"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format/datetime";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";
import {
  CUSTOMER_ORDER_TABS,
  PROVIDER_ORDER_TABS,
  customerOrderTab,
  providerOrderTab,
  type CustomerOrderTab,
  type ProviderOrderTab,
} from "@/lib/orders/tabs";
import { resolveOrderDisplayStatus } from "@/lib/orders/display-status";
import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";

type CustomerProps = {
  mode: "customer";
  requests: ServiceRequestDetail[];
  tabCounts: Record<CustomerOrderTab, number>;
  userId: string;
  /** Path prefix only — never pass functions from Server → Client. */
  detailBasePath: string;
};

type ProviderProps = {
  mode: "provider";
  requests: ServiceRequestDetail[];
  tabCounts: Record<ProviderOrderTab, number>;
  userId: string;
  providerId: string;
  detailBasePath: string;
};

type Props = CustomerProps | ProviderProps;

export function OrdersBoard(props: Props) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const [query, setQuery] = useState("");

  const [customerTab, setCustomerTab] = useState<CustomerOrderTab>("pending");
  const [providerTab, setProviderTab] = useState<ProviderOrderTab>("waiting");

  useMarketplaceRealtime({
    userId: props.userId,
    providerId: props.mode === "provider" ? props.providerId : null,
    inboxAsCustomer: props.mode === "customer",
    inboxAsProviderId: props.mode === "provider" ? props.providerId : null,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.requests
      .filter((r) =>
        props.mode === "customer"
          ? customerOrderTab(r) === customerTab
          : providerOrderTab(r) === providerTab,
      )
      .filter((r) => {
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.providerName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      });
  }, [props, customerTab, providerTab, query]);

  const tabs =
    props.mode === "customer"
      ? CUSTOMER_ORDER_TABS.map((key) => ({
          key,
          label: t(`customerTabs.${key}`),
          count: props.tabCounts[key],
          active: customerTab === key,
          onSelect: () => setCustomerTab(key),
        }))
      : PROVIDER_ORDER_TABS.map((key) => ({
          key,
          label: t(`providerTabs.${key}`),
          count: props.tabCounts[key],
          active: providerTab === key,
          onSelect: () => setProviderTab(key),
        }));

  const base = props.detailBasePath.replace(/\/$/, "");

  return (
    <div className="space-y-5">
      <MarkNavChannelSeen channel="orders" />
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
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.active}
            onClick={tab.onSelect}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)] focus-visible:ring-offset-2",
              tab.active
                ? "bg-[var(--dalily-navy)] text-white"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--dalily-navy)]">
                {tab.count}
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
          {filtered.map((request) => {
            const display = resolveOrderDisplayStatus(request);
            return (
              <li key={request.id}>
                <Link
                  href={`${base}/${request.id}`}
                  className="block rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:border-[var(--dalily-gold)]/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{request.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {props.mode === "customer"
                          ? request.providerName
                          : request.customerName}
                      </p>
                    </div>
                    <Badge variant="secondary">{t(`status.${display}`)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(request.updated_at ?? request.created_at, locale)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
