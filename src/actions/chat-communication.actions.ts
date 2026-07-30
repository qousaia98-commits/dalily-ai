"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isEnterpriseCommunicationEnabled } from "@/lib/config/feature-flags";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import {
  toggleMessageReaction,
  setConversationMuted,
  blockChatUser,
  unblockChatUser,
  reportConversation,
  listOpenConversationReports,
  setConversationModerationStatus,
  resolveConversationReport,
  type ChatReportReason,
} from "@/domains/chat/communication";
import { assertChatParticipants } from "@/domains/chat";

function revalidateConversation(conversationId: string) {
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  revalidatePath("/admin/messages");
}

export async function toggleReactionAction(input: {
  messageId: string;
  conversationId: string;
  emoji: string;
}): Promise<{ success: boolean; error?: string; added?: boolean }> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const rate = checkRateLimit(rateLimitKey("chat_react", authUser.id), {
    max: 80,
    windowMs: 60_000,
  });
  if (!rate.ok) return { success: false, error: "rate_limited" };

  const gate = await assertChatParticipants({
    conversationId: input.conversationId,
    userId: authUser.id,
  });
  if (!gate.ok) return { success: false, error: gate.error };

  const result = await toggleMessageReaction({
    messageId: input.messageId,
    conversationId: input.conversationId,
    userId: authUser.id,
    emoji: input.emoji,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidateConversation(input.conversationId);
  return { success: true, added: result.added };
}

export async function muteConversationAction(input: {
  conversationId: string;
  muted: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const gate = await assertChatParticipants({
    conversationId: input.conversationId,
    userId: authUser.id,
  });
  if (!gate.ok) return { success: false, error: gate.error };

  const result = await setConversationMuted({
    conversationId: input.conversationId,
    userId: authUser.id,
    muted: input.muted,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidateConversation(input.conversationId);
  return { success: true };
}

export async function blockPeerAction(input: {
  conversationId: string;
  blockedId: string;
  block: boolean;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const gate = await assertChatParticipants({
    conversationId: input.conversationId,
    userId: authUser.id,
  });
  if (!gate.ok) return { success: false, error: gate.error };

  const result = input.block
    ? await blockChatUser({
        blockerId: authUser.id,
        blockedId: input.blockedId,
        reason: input.reason,
      })
    : await unblockChatUser({
        blockerId: authUser.id,
        blockedId: input.blockedId,
      });
  if (!result.ok) return { success: false, error: result.error };
  revalidateConversation(input.conversationId);
  return { success: true };
}

export async function reportConversationAction(input: {
  conversationId: string;
  reason: ChatReportReason;
  details?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const rate = checkRateLimit(rateLimitKey("chat_report", authUser.id), {
    max: 10,
    windowMs: 60_000,
  });
  if (!rate.ok) return { success: false, error: "rate_limited" };

  const gate = await assertChatParticipants({
    conversationId: input.conversationId,
    userId: authUser.id,
  });
  if (!gate.ok) return { success: false, error: gate.error };

  const result = await reportConversation({
    conversationId: input.conversationId,
    reporterId: authUser.id,
    reason: input.reason,
    details: input.details,
  });
  if (!result.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function adminListChatReportsAction(): Promise<{
  success: boolean;
  reports: Awaited<ReturnType<typeof listOpenConversationReports>>;
  error?: string;
}> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, reports: [], error: "feature_disabled" };
  }
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { success: false, reports: [], error: "forbidden" };
  }
  const reports = await listOpenConversationReports();
  return { success: true, reports };
}

export async function adminResolveChatReportAction(input: {
  reportId: string;
  status: "resolved" | "dismissed";
  suspendConversationId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { success: false, error: "forbidden" };
  }

  const result = await resolveConversationReport({
    reportId: input.reportId,
    resolverId: authUser.id,
    status: input.status,
  });
  if (!result.ok) return { success: false, error: result.error };

  if (input.suspendConversationId) {
    await setConversationModerationStatus({
      conversationId: input.suspendConversationId,
      status: "suspended",
    });
  }
  revalidatePath("/admin/messages");
  return { success: true };
}

export async function adminSuspendConversationAction(input: {
  conversationId: string;
  suspend: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEnterpriseCommunicationEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) {
    return { success: false, error: "forbidden" };
  }
  const result = await setConversationModerationStatus({
    conversationId: input.conversationId,
    status: input.suspend ? "suspended" : "active",
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/admin/messages");
  return { success: true };
}
