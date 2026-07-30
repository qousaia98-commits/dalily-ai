/**
 * Pure wallet ledger balance projection — mirrors apply_wallet_ledger_entry RPC.
 * Used by unit tests; production mutations still go through the RPC.
 */

export type WalletBalanceSnapshot = {
  available: number;
  reserved: number;
  pendingPayout: number;
  refund: number;
  bonus: number;
  status: "active" | "frozen" | "closed";
};

export type LedgerEntryType =
  | "credit"
  | "debit"
  | "reserve"
  | "release"
  | "refund"
  | "payout"
  | "bonus"
  | "fee"
  | "adjustment";

/**
 * Project next balances for a single ledger entry.
 * Rejects insufficient funds / reserved and never returns negative balances.
 */
export function computeWalletBalancesAfterEntry(
  wallet: WalletBalanceSnapshot,
  entry: { entryType: LedgerEntryType; amount: number },
):
  | { ok: true; balances: WalletBalanceSnapshot }
  | { ok: false; error: string } {
  if (!(entry.amount > 0) || !Number.isFinite(entry.amount)) {
    return { ok: false, error: "invalid_amount" };
  }
  if (wallet.status !== "active") {
    return { ok: false, error: "wallet_frozen" };
  }

  let available = wallet.available;
  let reserved = wallet.reserved;
  let pendingPayout = wallet.pendingPayout;
  let refund = wallet.refund;
  let bonus = wallet.bonus;

  switch (entry.entryType) {
    case "credit":
    case "bonus":
    case "refund":
      available += entry.amount;
      if (entry.entryType === "refund") refund += entry.amount;
      if (entry.entryType === "bonus") bonus += entry.amount;
      break;
    case "debit":
    case "fee":
    case "payout":
      if (available < entry.amount) {
        return { ok: false, error: "insufficient_funds" };
      }
      available -= entry.amount;
      if (entry.entryType === "payout") pendingPayout += entry.amount;
      break;
    case "reserve":
      if (available < entry.amount) {
        return { ok: false, error: "insufficient_funds" };
      }
      available -= entry.amount;
      reserved += entry.amount;
      break;
    case "release":
      if (reserved < entry.amount) {
        return { ok: false, error: "insufficient_reserved" };
      }
      reserved -= entry.amount;
      break;
    case "adjustment":
      available += entry.amount;
      break;
    default:
      return { ok: false, error: "invalid_entry" };
  }

  if (
    available < 0 ||
    reserved < 0 ||
    pendingPayout < 0 ||
    refund < 0 ||
    bonus < 0
  ) {
    return { ok: false, error: "balance_invariant" };
  }

  return {
    ok: true,
    balances: {
      available,
      reserved,
      pendingPayout,
      refund,
      bonus,
      status: wallet.status,
    },
  };
}
