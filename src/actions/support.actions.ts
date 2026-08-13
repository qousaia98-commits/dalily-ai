"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { isAdminUser, isBusinessUser } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportMessageStatus } from "@/lib/admin/support-center";

const MAX_SUBJECT = 150;
const MAX_MESSAGE = 4000;

export async function submitSupportMessageAction(input: {
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const subject = input.subject.trim().slice(0, MAX_SUBJECT);
  const message = input.message.trim().slice(0, MAX_MESSAGE);
  if (!subject) return { success: false, error: "subject_required" };
  if (!message) return { success: false, error: "message_required" };

  const admin = createAdminClient();
  const role = isBusinessUser(authUser.roles) ? "business" : "customer";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("support_messages").insert({
    user_id: authUser.id,
    role,
    subject,
    message,
  });
  if (error) return { success: false, error: "submit_failed" };

  try {
    const { getCompanyBillingSettings } = await import(
      "@/lib/financial-documents/company-settings"
    );
    const { sendSupportMessageNotificationEmail } = await import(
      "@/lib/email/dalily-email"
    );
    const settings = await getCompanyBillingSettings();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    if (settings.supportEmail) {
      void sendSupportMessageNotificationEmail({
        to: settings.supportEmail,
        fromName: authUser.displayName ?? authUser.email ?? "",
        role,
        subject,
        message,
        adminUrl: `${appUrl}/admin/support`,
      });
    }
  } catch {
    // soft — the in-app admin inbox is the source of truth, email is best-effort
  }

  return { success: true };
}

export async function resolveSupportMessageAction(input: {
  messageId: string;
  status: SupportMessageStatus;
  adminNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireAdminUser();
  if (!isAdminUser(authUser.roles)) return { success: false, error: "forbidden" };

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status: input.status };
  if (input.adminNote !== undefined) patch.admin_note = input.adminNote.trim() || null;
  if (input.status === "resolved" || input.status === "closed") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = authUser.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("support_messages")
    .update(patch)
    .eq("id", input.messageId);
  if (error) return { success: false, error: "update_failed" };

  revalidatePath("/admin/support");
  return { success: true };
}
