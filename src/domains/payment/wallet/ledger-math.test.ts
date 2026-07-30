import { describe, expect, it } from "vitest";
import { computeWalletBalancesAfterEntry } from "@/domains/payment/wallet/ledger-math";

const active = {
  available: 100,
  reserved: 20,
  pendingPayout: 0,
  refund: 0,
  bonus: 0,
  status: "active" as const,
};

describe("wallet ledger math", () => {
  it("credits increase available", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "credit",
      amount: 50,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.balances.available).toBe(150);
  });

  it("debits decrease available", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "debit",
      amount: 40,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.balances.available).toBe(60);
  });

  it("rejects insufficient funds on debit", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "debit",
      amount: 101,
    });
    expect(r).toEqual({ ok: false, error: "insufficient_funds" });
  });

  it("reserve moves available → reserved", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "reserve",
      amount: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.balances.available).toBe(70);
      expect(r.balances.reserved).toBe(50);
    }
  });

  it("rejects reserve when available insufficient", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "reserve",
      amount: 101,
    });
    expect(r).toEqual({ ok: false, error: "insufficient_funds" });
  });

  it("release decreases reserved without increasing available", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "release",
      amount: 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.balances.reserved).toBe(10);
      expect(r.balances.available).toBe(100);
    }
  });

  it("rejects release when reserved insufficient", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "release",
      amount: 21,
    });
    expect(r).toEqual({ ok: false, error: "insufficient_reserved" });
  });

  it("refund credits available and refund bucket", () => {
    const r = computeWalletBalancesAfterEntry(active, {
      entryType: "refund",
      amount: 15,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.balances.available).toBe(115);
      expect(r.balances.refund).toBe(15);
    }
  });

  it("rejects non-positive and non-finite amounts", () => {
    expect(
      computeWalletBalancesAfterEntry(active, {
        entryType: "credit",
        amount: 0,
      }).ok,
    ).toBe(false);
    expect(
      computeWalletBalancesAfterEntry(active, {
        entryType: "credit",
        amount: -1,
      }).ok,
    ).toBe(false);
    expect(
      computeWalletBalancesAfterEntry(active, {
        entryType: "credit",
        amount: Number.NaN,
      }).ok,
    ).toBe(false);
  });

  it("rejects mutations on frozen wallets", () => {
    const r = computeWalletBalancesAfterEntry(
      { ...active, status: "frozen" },
      { entryType: "credit", amount: 1 },
    );
    expect(r).toEqual({ ok: false, error: "wallet_frozen" });
  });

  it("never produces negative balances on valid paths", () => {
    const paths = [
      { entryType: "debit" as const, amount: 100 },
      { entryType: "reserve" as const, amount: 100 },
      { entryType: "release" as const, amount: 20 },
      { entryType: "payout" as const, amount: 50 },
    ];
    for (const entry of paths) {
      const r = computeWalletBalancesAfterEntry(active, entry);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.balances.available).toBeGreaterThanOrEqual(0);
        expect(r.balances.reserved).toBeGreaterThanOrEqual(0);
        expect(r.balances.pendingPayout).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
