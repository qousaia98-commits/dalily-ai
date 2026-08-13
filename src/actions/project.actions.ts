"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/session";
import { isMultiServiceProjectsEnabled } from "@/lib/config/feature-flags";
import {
  markPackageStatus,
  reorderProjectPackages,
  ensureProjectConversation,
} from "@/lib/projects";
import type { PackageStatus } from "@/lib/projects";

export type ProjectActionResult =
  | { ok: true; conversationId?: string | null }
  | { ok: false; error: string };

export async function reorderProjectPackagesAction(input: {
  projectId: string;
  orderedPackageIds: string[];
}): Promise<ProjectActionResult> {
  if (!isMultiServiceProjectsEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await reorderProjectPackages({
    projectId: input.projectId,
    orderedPackageIds: input.orderedPackageIds,
    customerId: user.id,
  });
  if (!ok) return { ok: false, error: "reorder_failed" };
  revalidatePath(`/account/projects/${input.projectId}`);
  return { ok: true };
}

export async function updateProjectPackageStatusAction(input: {
  projectId: string;
  packageId: string;
  status: PackageStatus;
}): Promise<ProjectActionResult> {
  if (!isMultiServiceProjectsEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await markPackageStatus({
    packageId: input.packageId,
    status: input.status,
    customerId: user.id,
  });
  if (!ok) return { ok: false, error: "status_failed" };
  revalidatePath(`/account/projects/${input.projectId}`);
  return { ok: true };
}

export async function openProjectChatAction(input: {
  projectId: string;
  providerId: string;
  packageId?: string | null;
  serviceRequestId?: string | null;
}): Promise<ProjectActionResult> {
  if (!isMultiServiceProjectsEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const conversationId = await ensureProjectConversation({
    projectId: input.projectId,
    customerId: user.id,
    providerId: input.providerId,
    packageId: input.packageId,
    serviceRequestId: input.serviceRequestId,
  });
  if (!conversationId) return { ok: false, error: "chat_failed" };
  revalidatePath(`/account/projects/${input.projectId}`);
  return { ok: true, conversationId };
}
