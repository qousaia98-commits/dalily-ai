/**
 * Cham Cash (apisyria.com) API client — isolated on purpose.
 *
 * IMPORTANT: apisyria.com's request/response shape has not been verified
 * against real API docs/credentials yet (no Cham Cash account exists at
 * the time this was written). Do NOT guess field names for a payment
 * verification path — a wrong guess could either reject real payments or,
 * worse, accept a forged one.
 *
 * `verifyChamCashTransaction` below always returns `api_not_integrated`
 * until the fetch call is filled in. That is the safe default: the
 * calling provider (`shamcash.provider.ts`) treats this as "could not
 * verify automatically" and falls back to manual admin review — it never
 * auto-approves a subscription on an unverified response.
 *
 * TODO once real Cham Cash / apisyria.com API access exists:
 * 1. Confirm the endpoint path, HTTP method, and auth header (API key?
 *    bearer token? query param?) from https://apisyria.com/api/docs.
 * 2. Confirm the `find_tx` (or equivalent) request body/params — likely
 *    needs the transaction id and our account address.
 * 3. Confirm the response fields for: transaction status, amount,
 *    currency, sender account, destination account, timestamp.
 * 4. Replace the body of `verifyChamCashTransaction` with a real fetch()
 *    call and map the response into `ChamCashVerifyResult`.
 */

import {
  getChamCashAccountAddress,
  getChamCashApiBaseUrl,
  getChamCashApiKey,
  isChamCashConfigured,
} from "@/lib/payment/config";

export type ChamCashVerifyResult =
  | {
      ok: true;
      transactionId: string;
      /** Amount as reported by Cham Cash, in whatever currency they settle (likely SYP). */
      amount: number;
      currency: string;
      destinationAccount: string;
    }
  | {
      ok: false;
      reason: "api_not_integrated" | "not_configured" | "not_found" | "request_failed";
    };

export async function verifyChamCashTransaction(input: {
  transactionId: string;
}): Promise<ChamCashVerifyResult> {
  if (!isChamCashConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const transactionId = input.transactionId.trim();
  if (!transactionId) {
    return { ok: false, reason: "not_found" };
  }

  // Referenced for when the real call is wired in — kept here so the
  // TODO above has everything it needs at hand.
  void getChamCashApiBaseUrl();
  void getChamCashAccountAddress();
  void getChamCashApiKey();

  // Not implemented yet — see file header. Never fabricate a success.
  return { ok: false, reason: "api_not_integrated" };
}
