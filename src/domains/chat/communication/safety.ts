/**
 * Mute / block / report / moderation — safety layer.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatReportReason, ConversationSafetySettings } from "./types";

export async function setConversationMuted(input: {
  conversationId: string;
  userId: string;
  muted: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversation_participants")
    .update({ muted: input.muted })
    .eq("conversation_id", input.conversationId)
    .eq("user_id", input.userId);

  if (error) return { ok: false, error: "update_failed" };
  return { ok: true };
}

export async function getConversationSafetySettings(input: {
  conversationId: string;
  userId: string;
  peerUserId: string | null;
}): Promise<ConversationSafetySettings> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const [{ data: part }, { data: conv }, { data: block }] = await Promise.all([
    client
      .from("conversation_participants")
      .select("muted")
      .eq("conversation_id", input.conversationId)
      .eq("user_id", input.userId)
      .maybeSingle(),
    client
      .from("conversations")
      .select("moderation_status")
      .eq("id", input.conversationId)
      .maybeSingle(),
    input.peerUserId
      ? client
          .from("chat_user_blocks")
          .select("id")
          .eq("blocker_id", input.userId)
          .eq("blocked_id", input.peerUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const mod = (conv?.moderation_status as string | undefined) ?? "active";
  return {
    muted: Boolean(part?.muted),
    blockedPeer: Boolean(block?.id),
    moderationStatus:
      mod === "suspended" || mod === "under_review" ? mod : "active",
  };
}

export async function blockChatUser(input: {
  blockerId: string;
  blockedId: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.blockerId === input.blockedId) {
    return { ok: false, error: "validation_error" };
  }
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("chat_user_blocks").upsert(
    {
      blocker_id: input.blockerId,
      blocked_id: input.blockedId,
      reason: input.reason ?? null,
    },
    { onConflict: "blocker_id,blocked_id" },
  );
  if (error) return { ok: false, error: "update_failed" };
  return { ok: true };
}

export async function unblockChatUser(input: {
  blockerId: string;
  blockedId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("chat_user_blocks")
    .delete()
    .eq("blocker_id", input.blockerId)
    .eq("blocked_id", input.blockedId);
  if (error) return { ok: false, error: "update_failed" };
  return { ok: true };
}

export async function isMessagingBlocked(input: {
  senderId: string;
  recipientId: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("chat_user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${input.senderId},blocked_id.eq.${input.recipientId}),and(blocker_id.eq.${input.recipientId},blocked_id.eq.${input.senderId})`,
    )
    .limit(1);
  return Boolean(data?.length);
}

export async function reportConversation(input: {
  conversationId: string;
  reporterId: string;
  reason: ChatReportReason;
  details?: string;
}): Promise<{ ok: true; reportId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("chat_conversation_reports")
    .insert({
      conversation_id: input.conversationId,
      reporter_id: input.reporterId,
      reason_code: input.reason,
      details: input.details?.slice(0, 1000) ?? null,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data?.id) return { ok: false, error: "report_failed" };
  return { ok: true, reportId: data.id as string };
}

export async function listOpenConversationReports(limit = 50): Promise<
  Array<{
    id: string;
    conversationId: string;
    reporterId: string;
    reasonCode: string;
    details: string | null;
    status: string;
    createdAt: string;
  }>
> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("chat_conversation_reports")
    .select("id, conversation_id, reporter_id, reason_code, details, status, created_at")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    conversationId: r.conversation_id as string,
    reporterId: r.reporter_id as string,
    reasonCode: r.reason_code as string,
    details: (r.details as string | null) ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

export async function setConversationModerationStatus(input: {
  conversationId: string;
  status: "active" | "suspended" | "under_review";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("conversations")
    .update({ moderation_status: input.status })
    .eq("id", input.conversationId);
  if (error) return { ok: false, error: "update_failed" };
  return { ok: true };
}

export async function resolveConversationReport(input: {
  reportId: string;
  resolverId: string;
  status: "resolved" | "dismissed";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("chat_conversation_reports")
    .update({
      status: input.status,
      resolved_by: input.resolverId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.reportId);
  if (error) return { ok: false, error: "update_failed" };
  return { ok: true };
}
