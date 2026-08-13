import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isAiPlatformEnabled,
  isAiTranslationEnabled,
} from "@/lib/config/feature-flags";
import { translateText } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import type { ChatAiLanguage } from "@/lib/ai/chat/types";

/**
 * POST /api/ai/translation — parallel translation; never overwrites original.
 */
export async function POST(request: Request) {
  if (!isAiPlatformEnabled() || !isAiTranslationEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("ai_translation", authUser.id), {
    max: 40,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    conversationId?: string;
    messageId?: string;
    text?: string;
    targetLang?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const targetLang = body.targetLang as ChatAiLanguage;
  if (!["ar", "en", "de"].includes(targetLang)) {
    return NextResponse.json({ error: "invalid_lang" }, { status: 400 });
  }
  if (!body.conversationId || !body.messageId || !body.text?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const translation = await translateText({
    conversationId: body.conversationId,
    messageId: body.messageId,
    userId: authUser.id,
    text: body.text.slice(0, 4000),
    targetLang,
  });

  if (!translation) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    translation,
    originalPreserved: true,
  });
}
