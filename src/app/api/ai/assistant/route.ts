import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isAiAssistantEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { runCustomerAssistant, runProviderAssistant } from "@/domains/ai";
import type { AiAssistantCapability } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

const CUSTOMER_CAPS = new Set<AiAssistantCapability>([
  "improve_description",
  "structure_request",
  "recommend_category",
  "estimate_budget",
  "estimate_time",
  "recommend_providers",
  "explain_match",
  "compare_offers",
  "summarize_reviews",
  "platform_faq",
  "dispute_help",
]);

const PROVIDER_CAPS = new Set<AiAssistantCapability>([
  "draft_offer",
  "improve_proposal",
  "improve_profile",
  "suggest_pricing",
  "suggest_times",
  "trust_tips",
  "draft_reply",
  "summarize_chat",
]);

/**
 * POST /api/ai/assistant — customer/provider assistant (never auto-submits/sends).
 */
export async function POST(request: Request) {
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("ai_assistant", authUser.id), {
    max: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    role?: string;
    capability?: string;
    prompt?: string;
    locale?: string;
    context?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const role = body.role === "provider" ? "provider" : "customer";
  const capability = body.capability as AiAssistantCapability;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt || prompt.length > 4000) {
    return NextResponse.json({ error: "invalid_prompt" }, { status: 400 });
  }

  const allowed = role === "provider" ? PROVIDER_CAPS : CUSTOMER_CAPS;
  if (!allowed.has(capability)) {
    return NextResponse.json({ error: "invalid_capability" }, { status: 400 });
  }

  const result =
    role === "provider"
      ? await runProviderAssistant({
          capability,
          prompt,
          userId: authUser.id,
          locale: body.locale,
          context: body.context,
        })
      : await runCustomerAssistant({
          capability,
          prompt,
          userId: authUser.id,
          locale: body.locale,
          context: body.context,
        });

  if (!result) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    assistant: result,
    controls: {
      neverAutoSubmit: true,
      neverAutoSend: true,
      regeneratable: true,
    },
  });
}
