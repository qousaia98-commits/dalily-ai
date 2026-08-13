import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isAiFraudEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { analyzeEntityFraud, recommendModeration } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { canAccessAdminPanel } from "@/lib/auth/roles";
import type { RiskEntityType } from "@/lib/fraud/types";

/**
 * POST /api/ai/fraud — risk analysis (admin). Never auto-bans.
 */
export async function POST(request: Request) {
  if (!isAiPlatformEnabled() || !isAiFraudEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser || !canAccessAdminPanel(authUser.roles)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rate = checkRateLimit(rateLimitKey("ai_fraud", authUser.id), {
    max: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    mode?: string;
    entityType?: string;
    entityId?: string;
    text?: string;
    targetType?: string;
    targetId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.mode === "moderation") {
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text_required" }, { status: 400 });
    }
    const moderation = await recommendModeration({
      targetType: (body.targetType as never) ?? "other",
      targetId: body.targetId,
      text: body.text,
      actorUserId: authUser.id,
    });
    return NextResponse.json({
      moderation,
      neverAutoEnforce: true,
    });
  }

  if (!body.entityType || !body.entityId) {
    return NextResponse.json({ error: "entity_required" }, { status: 400 });
  }

  const analysis = await analyzeEntityFraud({
    entityType: body.entityType as RiskEntityType,
    entityId: body.entityId,
  });

  return NextResponse.json({
    analysis,
    neverAutoBan: true,
  });
}
