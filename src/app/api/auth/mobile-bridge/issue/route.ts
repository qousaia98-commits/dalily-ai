import { NextResponse } from "next/server";
import { handleApiRoute } from "@/lib/observability/api-route";
import {
  extractBearerToken,
  getUserIdFromAccessToken,
  issueMobileBridgeCode,
} from "@/lib/auth/mobile-bridge";

type IssueBody = {
  refresh_token?: unknown;
};

/**
 * POST /api/auth/mobile-bridge/issue
 * Auth: Authorization: Bearer <supabase access_token>
 * Body: { refresh_token: string } — HTTPS body only (never put tokens in URLs).
 * Returns: { code } opaque one-time code (TTL 60s).
 */
export async function POST(request: Request) {
  return handleApiRoute("mobile_bridge_issue", async () => {
    const accessToken = extractBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: IssueBody;
    try {
      body = (await request.json()) as IssueBody;
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const refreshToken =
      typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
    if (!refreshToken) {
      return NextResponse.json(
        { error: "refresh_token_required" },
        { status: 400 },
      );
    }

    const userId = await getUserIdFromAccessToken(accessToken);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { code } = await issueMobileBridgeCode({
      userId,
      accessToken,
      refreshToken,
    });

    return NextResponse.json({ code });
  });
}
