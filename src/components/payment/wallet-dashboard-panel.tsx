"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

type WalletDto = {
  walletId: string;
  currency: string;
  available: number;
  reserved: number;
  pendingPayout: number;
  refund: number;
  bonus: number;
  status: string;
};

type LedgerDto = {
  id: string;
  entryType: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
};

type HistoryDto = {
  id: string;
  kind: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  description?: string | null;
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "SYP" ? "USD" : currency,
      currencyDisplay: currency === "SYP" ? "code" : "symbol",
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace("USD", currency);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Responsive wallet + history panel (customer & provider).
 */
export function WalletDashboardPanel({ mode }: { mode: "customer" | "business" }) {
  const t = useTranslations("wallet");
  const [pending, startTransition] = useTransition();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [ledger, setLedger] = useState<LedgerDto[]>([]);
  const [history, setHistory] = useState<HistoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [wRes, hRes] = await Promise.all([
          fetch("/api/payments/wallet"),
          fetch("/api/payments/transactions?limit=30"),
        ]);
        if (!wRes.ok) {
          const body = await wRes.json().catch(() => ({}));
          throw new Error(body.error ?? "wallet_load_failed");
        }
        const wJson = await wRes.json();
        const hJson = hRes.ok ? await hRes.json() : { history: [] };
        if (cancelled) return;
        setWallet(wJson.wallet);
        setLedger(wJson.ledger ?? []);
        setHistory(hJson.history ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "load_failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    startTransition(() => {
      void load();
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (loading || pending) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
      >
        <p className="font-medium text-destructive">{t("errorTitle")}</p>
        <p className="mt-1 text-muted-foreground">{t("errorBody")}</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <p className="text-sm text-muted-foreground">{t("empty")}</p>
    );
  }

  const balances = [
    { key: "available", value: wallet.available },
    { key: "reserved", value: wallet.reserved },
    { key: "pendingPayout", value: wallet.pendingPayout },
    { key: "refund", value: wallet.refund },
    { key: "bonus", value: wallet.bonus },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {balances.map((b) => (
          <div
            key={b.key}
            className="rounded-xl border border-border/60 bg-background/80 p-3 sm:p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(`balances.${b.key}`)}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {formatMoney(b.value, wallet.currency)}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("ledgerTitle")}</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ledgerEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {ledger.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium capitalize">{row.entryType}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.description ?? "—"}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("historyTitle")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {history.map((row) => (
              <li
                key={`${row.kind}-${row.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {row.kind} · {row.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.description ?? row.id.slice(0, 8)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
