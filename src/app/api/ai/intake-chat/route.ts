import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isAiPlatformEnabled } from "@/lib/config/feature-flags";
import {
  INTAKE_CHAT_MAX_MESSAGE_CHARS,
  INTAKE_CHAT_MAX_MESSAGES,
  runIntakeChatTurn,
  type IntakeChatMessage,
} from "@/domains/customer/intake-chat";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * POST /api/ai/intake-chat — guest-accessible multi-turn intake helper.
 * Recommendations / clarifying chat only; never creates requests.
 *
 * Rate limit: 8 requests / 60s per client IP (stricter than authenticated
 * assistant's 20/60s — paid LLM with no login gate).
 */
export async function POST(request: Request) {
  return handleApiRoute("ai_intake_chat", async () => {
    if (!isAiPlatformEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0]?.trim() || "local";
    const rate = checkRateLimit(rateLimitKey("ai_intake_chat", clientIp), {
      max: 8,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterMs: rate.retryAfterMs },
        { status: 429 },
      );
    }

    const authUser = await getAuthUser();

    let body: {
      messages?: IntakeChatMessage[];
      locale?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!Array.isArray(body.messages)) {
      return NextResponse.json({ error: "invalid_messages" }, { status: 400 });
    }

    if (body.messages.length > INTAKE_CHAT_MAX_MESSAGES) {
      return NextResponse.json({ error: "too_many_messages" }, { status: 400 });
    }

    for (const msg of body.messages) {
      const content = String(msg?.content ?? "");
      if (
        (msg?.role !== "user" && msg?.role !== "assistant") ||
        !content.trim() ||
        content.length > INTAKE_CHAT_MAX_MESSAGE_CHARS
      ) {
        return NextResponse.json({ error: "invalid_message" }, { status: 400 });
      }
    }

    const result = await runIntakeChatTurn({
      messages: body.messages,
      locale: body.locale,
      actorUserId: authUser?.id ?? null,
    });

    if (!result.ok) {
      const status =
        result.error === "content_blocked"
          ? 400
          : result.error === "feature_disabled"
            ? 404
            : result.error === "unavailable"
              ? 503
              : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      reply: result.turn.reply,
      problemSummary: result.turn.problemSummary,
      readyHint: result.turn.readyHint,
      controls: {
        neverAutoSubmit: true,
        neverAutoSend: true,
      },
    });
  });
}
