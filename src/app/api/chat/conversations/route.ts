import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isEnterpriseCommunicationEnabled,
  isMessagingEngineEnabled,
} from "@/lib/config/feature-flags";
import { listConversationsForViewer } from "@/domains/chat";
import { getOwnedProvider } from "@/lib/providers/database";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * GET /api/chat/conversations — authenticated conversation list (public DTO).
 */
export async function GET(request: Request) {
  return handleApiRoute("chat_conversations", async () => {
    if (!isMessagingEngineEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }

    const rate = checkRateLimit(rateLimitKey("chat_api_list", authUser.id), {
      max: 60,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const viewer = searchParams.get("viewer") === "business" ? "business" : "customer";
    const includeArchived = searchParams.get("archived") === "1";

    let providerId: string | null = null;
    if (viewer === "business") {
      const provider = await getOwnedProvider(authUser.id);
      if (!provider) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      providerId = provider.id;
    }

    const conversations = await listConversationsForViewer({
      viewer,
      userId: authUser.id,
      providerId,
      includeArchived,
    });

    const unreadTotal = conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0);

    return NextResponse.json(
      {
        conversations: conversations.map((c) => ({
          id: c.id,
          peerName: c.peerName,
          previewText: c.previewText,
          lastMessageAt: c.lastMessageAt,
          unreadCount: c.unreadCount,
          pinned: c.pinned,
          archived: c.archived,
          serviceRequestId: c.serviceRequestId,
        })),
        unreadTotal,
        enterprise: isEnterpriseCommunicationEnabled(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
        },
      },
    );
  });
}
