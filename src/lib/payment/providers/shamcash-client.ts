/**
 * Cham Cash (apisyria.com) API client — isolated on purpose.
 *
 * IMPORTANT: apisyria.com's request/response shape has not been verified
 * against real API docs/credentials yet (no Cham Cash account exists at
 * the time this was written). Do NOT guess field names for a payment
 * verification path — a wrong guess could either reject real payments or,
 * worse, accept a forged one.
 *
 * Every function below always returns `api_not_integrated` until its
 * fetch call is filled in. That is the safe default: the calling
 * provider (`shamcash.provider.ts`) treats this as "could not verify /
 * initiate automatically" and degrades gracefully — it never fabricates
 * a success and never requires manual admin review either.
 *
 * Two tiers, both wired end-to-end and both dormant until implemented:
 *
 * 1. One-click (preferred): `createChamCashPaymentRequest` asks Cham Cash
 *    for a hosted payment page; the provider approves there with one
 *    click, gets redirected back, and `checkChamCashPaymentRequestStatus`
 *    confirms it — no manual transaction-id entry at all. Only usable if
 *    apisyria.com actually offers payment *initiation*, not just lookup.
 * 2. Paste-to-verify (fallback): the provider pays in the Cham Cash app
 *    themselves and pastes the transaction id; `verifyChamCashTransaction`
 *    confirms it. Works with a lookup-only API.
 *
 * The UI automatically picks whichever tier `createPayment` manages to
 * activate (see shamcash.provider.ts) — nothing else needs to change
 * once either of these is wired up.
 *
 * TODO once real Cham Cash / apisyria.com API access exists:
 * 1. Confirm the endpoint paths, HTTP method(s), and auth header (API
 *    key? bearer token? query param?) from https://apisyria.com/api/docs.
 * 2. Confirm whether a payment/checkout *initiation* endpoint exists at
 *    all (tier 1) — many regional wallet APIs only expose transaction
 *    lookup (tier 2). If it doesn't exist, leave createChamCashPaymentRequest
 *    returning `unsupported` permanently and only implement tier 2.
 * 3. Confirm the `find_tx` (or equivalent) request body/params — likely
 *    needs the transaction id and our account address.
 * 4. Confirm the response fields for: transaction status, amount,
 *    currency, sender account, destination account, timestamp.
 * 5. Replace the stub bodies below with real fetch() calls and map the
 *    responses into the shared result types.
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

export type ChamCashPaymentRequestResult =
  | {
      ok: true;
      /** Cham Cash's own id for this payment request — store it, use it to poll status. */
      providerPaymentId: string;
      /** Hosted page the provider is redirected to for one-click approval. */
      redirectUrl: string;
    }
  | {
      ok: false;
      reason: "api_not_integrated" | "not_configured" | "unsupported" | "request_failed";
    };

/**
 * Tier 1 — ask Cham Cash to open a hosted, one-click payment request.
 * Stub: see file header. Returns `api_not_integrated` until wired up (or
 * `unsupported` permanently, if apisyria.com turns out not to offer this).
 */
export async function createChamCashPaymentRequest(input: {
  amount: number;
  currency: string;
  reference: string;
  /** Where Cham Cash should send the provider back after approval/decline. */
  returnUrl: string;
}): Promise<ChamCashPaymentRequestResult> {
  if (!isChamCashConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  void getChamCashApiBaseUrl();
  void getChamCashAccountAddress();
  void getChamCashApiKey();
  void input;

  // Not implemented yet — see file header. Never fabricate a redirect URL.
  return { ok: false, reason: "api_not_integrated" };
}

/**
 * Tier 1 — check whether a previously-created payment request has been
 * approved yet. Stub: see file header.
 */
export async function checkChamCashPaymentRequestStatus(input: {
  providerPaymentId: string;
}): Promise<ChamCashVerifyResult> {
  if (!isChamCashConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  if (!input.providerPaymentId.trim()) {
    return { ok: false, reason: "not_found" };
  }

  void getChamCashApiBaseUrl();
  void getChamCashAccountAddress();
  void getChamCashApiKey();

  // Not implemented yet — see file header. Never fabricate a success.
  return { ok: false, reason: "api_not_integrated" };
}
