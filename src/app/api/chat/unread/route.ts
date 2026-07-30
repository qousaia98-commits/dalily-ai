import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isMessagingEngineEnabled } from "@/lib/config/feature-flags";
import { listConversationsForViewer } from "@/domains/chat";
import { getOwnedProvider } from "@/lib/providers/database";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * GET /api/chat/unread — aggregate unread badge counts.
 */
export async function GET() {
  if (!isMessagingEngineEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("chat_api_unread", authUser.id), {
    max: 120,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const provider = await getOwnedProvider(authUser.id);
  const [customer, business] = await Promise.all([
    listConversationsForViewer({
      viewer: "customer",
      userId: authUser.id,
    }),
    provider
      ? listConversationsForViewer({
          viewer: "business",
          userId: authUser.id,
          providerId: provider.id,
        })
      : Promise.resolve([]),
  ]);

  const customerUnread = customer.reduce((n, c) => n + (c.unreadCount ?? 0), 0);
  const businessUnread = business.reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  return NextResponse.json({
    customerUnread,
    businessUnread,
    total: customerUnread + businessUnread,
  });
}
