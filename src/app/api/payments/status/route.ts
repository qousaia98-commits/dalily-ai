import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isEscrowEngineEnabled,
  isPaymentsV2Enabled,
  isRefundsDisputesEnabled,
} from "@/lib/config/feature-flags";
import { getEscrowById, listEscrows } from "@/domains/payment/escrow/engine";
import { canAccessEscrow, canAccessPayment, canAccessRefund } from "@/domains/payment/authz";
import { findOpenRefundForPayment, getRefundById } from "@/lib/refunds";
import { getOwnedProvider } from "@/lib/providers/database";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * GET /api/payments/status — escrow / refund status lookup.
 * ?escrowId= | ?refundId= | ?paymentId= (open refund)
 */
export async function GET(request: Request) {
  if (!isPaymentsV2Enabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("payments_status", authUser.id), {
    max: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const escrowId = searchParams.get("escrowId");
  const refundId = searchParams.get("refundId");
  const paymentId = searchParams.get("paymentId");
  const provider = await getOwnedProvider(authUser.id);

  if (escrowId && isEscrowEngineEnabled()) {
    const escrow = await getEscrowById(escrowId);
    if (!escrow) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const allowed = await canAccessEscrow({
      escrow,
      userId: authUser.id,
      roles: authUser.roles,
    });
    if (!allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ escrow });
  }

  if (refundId && isRefundsDisputesEnabled()) {
    const refund = await getRefundById(refundId);
    if (!refund) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const allowed = await canAccessRefund({
      refund,
      userId: authUser.id,
      roles: authUser.roles,
    });
    if (!allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      refund: {
        id: refund.id,
        status: refund.status,
        amount: refund.refundAmount,
        currency: refund.currency,
        paymentId: refund.paymentId,
        createdAt: refund.createdAt,
      },
    });
  }

  if (paymentId && isRefundsDisputesEnabled()) {
    const allowed = await canAccessPayment({
      paymentId,
      userId: authUser.id,
      roles: authUser.roles,
    });
    if (!allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const refund = await findOpenRefundForPayment(paymentId);
    return NextResponse.json({ refund: refund ?? null });
  }

  // Default: list viewer escrows
  if (isEscrowEngineEnabled()) {
    const escrows = await listEscrows({
      customerId: authUser.id,
      providerId: provider?.id,
      limit: 20,
    });
    return NextResponse.json({ escrows });
  }

  return NextResponse.json({ error: "missing_params" }, { status: 400 });
}
