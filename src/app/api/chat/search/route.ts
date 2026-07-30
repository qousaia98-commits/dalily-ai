import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isMessagingEngineEnabled } from "@/lib/config/feature-flags";
import { searchMessages } from "@/domains/chat";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * GET /api/chat/search?q=&conversationId=
 */
export async function GET(request: Request) {
  if (!isMessagingEngineEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("chat_api_search", authUser.id), {
    max: 40,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const conversationId = searchParams.get("conversationId");
  const results = await searchMessages({
    query: q.slice(0, 200),
    conversationId: conversationId && /^[0-9a-f-]{36}$/i.test(conversationId)
      ? conversationId
      : null,
    userId: authUser.id,
  });

  return NextResponse.json({
    results: results.map((r) => ({
      messageId: r.id,
      conversationId: r.conversationId,
      snippet: r.bodyText?.slice(0, 160) ?? "",
      createdAt: r.createdAt,
    })),
  });
}
