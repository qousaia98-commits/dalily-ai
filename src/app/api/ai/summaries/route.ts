import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isAiAssistantEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { summarizeArbitrary, summarizeConversation } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * POST /api/ai/summaries — advisory summaries.
 */
export async function POST(request: Request) {
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("ai_summaries", authUser.id), {
    max: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    kind?: string;
    conversationId?: string;
    text?: string;
    locale?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.kind === "conversation" && body.conversationId) {
    const summary = await summarizeConversation({
      conversationId: body.conversationId,
      userId: authUser.id,
      locale: body.locale,
    });
    if (!summary) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ summary, advisoryOnly: true });
  }

  const kind = (body.kind ?? "admin") as
    | "booking"
    | "offer"
    | "review"
    | "dispute"
    | "admin";
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  const summary = await summarizeArbitrary({
    kind,
    text: body.text,
    userId: authUser.id,
    locale: body.locale,
  });

  if (!summary) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ summary, advisoryOnly: true });
}
