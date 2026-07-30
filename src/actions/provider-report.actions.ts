"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/session";
import type { Json } from "@/types/database.types";

export type ProfileReportActionState = {
  success: boolean;
  error?: string;
};

type StoredReport = {
  id: string;
  reporterId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  status: "open" | "reviewed";
};

/** Customer reports a public provider profile for admin review (metadata queue). */
export async function reportProviderProfileAction(input: {
  providerId: string;
  reason: string;
  details?: string;
}): Promise<ProfileReportActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const reason = input.reason.trim().slice(0, 80);
  const details = (input.details ?? "").trim().slice(0, 1000);
  if (!reason || !/^[0-9a-f-]{36}$/i.test(input.providerId)) {
    return { success: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("providers")
    .select("id, metadata")
    .eq("id", input.providerId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!row) return { success: false, error: "not_found" };

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  const existing = Array.isArray(metadata.profile_reports)
    ? (metadata.profile_reports as StoredReport[])
    : [];

  // Rate-limit: one open report per reporter per provider.
  if (
    existing.some(
      (r) => r.reporterId === authUser.id && r.status === "open",
    )
  ) {
    return { success: false, error: "already_reported" };
  }

  const report: StoredReport = {
    id: crypto.randomUUID(),
    reporterId: authUser.id,
    reason,
    details: details || null,
    createdAt: new Date().toISOString(),
    status: "open",
  };

  metadata.profile_reports = [...existing, report].slice(-50);

  const { error } = await admin
    .from("providers")
    .update({
      metadata: metadata as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.providerId);

  if (error) return { success: false, error: "failed" };
  return { success: true };
}

/** Admin acknowledges an open profile report. */
export async function acknowledgeProviderProfileReportAction(input: {
  providerId: string;
  reportId: string;
}): Promise<ProfileReportActionState> {
  await requireAdminUser();

  if (!/^[0-9a-f-]{36}$/i.test(input.providerId) || !input.reportId) {
    return { success: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("providers")
    .select("metadata")
    .eq("id", input.providerId)
    .maybeSingle();

  if (!row) return { success: false, error: "not_found" };

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  const existing = Array.isArray(metadata.profile_reports)
    ? (metadata.profile_reports as StoredReport[])
    : [];

  metadata.profile_reports = existing.map((r) =>
    r.id === input.reportId ? { ...r, status: "reviewed" as const } : r,
  );

  const { error } = await admin
    .from("providers")
    .update({
      metadata: metadata as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.providerId);

  if (error) return { success: false, error: "failed" };
  revalidatePath("/admin/providers");
  revalidatePath(`/admin/providers/${input.providerId}`);
  return { success: true };
}
