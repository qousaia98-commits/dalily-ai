import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isFinancialDocumentsEnabled,
  isPaymentsV2Enabled,
} from "@/lib/config/feature-flags";
import { listFinancialDocuments } from "@/domains/payment/invoices";
import { getOwnedProvider } from "@/lib/providers/database";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { canManageFinance } from "@/lib/auth/roles";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * GET /api/payments/invoices — list financial documents for the viewer.
 */
export async function GET(request: Request) {
  return handleApiRoute("payments_invoices", async () => {
    if (!isPaymentsV2Enabled() || !isFinancialDocumentsEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }

    const rate = checkRateLimit(rateLimitKey("payments_invoices", authUser.id), {
      max: 40,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 30) || 30, 100);
    const isFinance = canManageFinance(authUser.roles);
    const provider = await getOwnedProvider(authUser.id);

    if (!provider && !isFinance) {
      return NextResponse.json({ invoices: [] });
    }

    const docs = await listFinancialDocuments({
      providerId: isFinance ? undefined : provider?.id,
      limit,
    });

    const invoices = docs.map((d) => ({
      id: d.id,
      type: d.documentType,
      status: d.status,
      number: d.documentNumber,
      total: d.total,
      currency: d.currency,
      createdAt: d.generatedAt,
    }));

    return NextResponse.json(
      { invoices },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  });
}
