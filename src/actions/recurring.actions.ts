"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/session";
import { isRecurringServicesEnabled } from "@/lib/config/feature-flags";
import {
  createRecurringPlan,
  renewPlan,
  setPlanStatus,
  skipVisit,
  rescheduleVisit,
  resolveRecommendation,
} from "@/lib/recurring";
import type { RecurringIntervalKind } from "@/lib/recurring";

export type RecurringActionResult =
  | { ok: true; planId?: string }
  | { ok: false; error: string };

export async function createRecurringPlanAction(input: {
  title: string;
  intervalKind: RecurringIntervalKind;
  customIntervalDays?: number | null;
  startDate: string;
  endDate?: string | null;
  providerId?: string | null;
  categorySlug?: string | null;
  preferredWeekdays?: number[];
  preferredTimeStart?: string | null;
  preferredTimeEnd?: string | null;
  durationMinutes?: number;
  locationText?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  autoRenew?: boolean;
}): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const created = await createRecurringPlan({
    customerId: user.id,
    ...input,
    createContract: true,
  });
  if (!created) return { ok: false, error: "create_failed" };
  revalidatePath("/account/recurring");
  return { ok: true, planId: created.plan.id };
}

export async function pauseRecurringPlanAction(
  planId: string,
): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await setPlanStatus({
    planId,
    customerId: user.id,
    status: "paused",
  });
  if (!ok) return { ok: false, error: "pause_failed" };
  revalidatePath("/account/recurring");
  return { ok: true, planId };
}

export async function resumeRecurringPlanAction(
  planId: string,
): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await setPlanStatus({
    planId,
    customerId: user.id,
    status: "active",
  });
  if (!ok) return { ok: false, error: "resume_failed" };
  revalidatePath("/account/recurring");
  return { ok: true, planId };
}

export async function cancelRecurringPlanAction(
  planId: string,
): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await setPlanStatus({
    planId,
    customerId: user.id,
    status: "cancelled",
  });
  if (!ok) return { ok: false, error: "cancel_failed" };
  revalidatePath("/account/recurring");
  return { ok: true, planId };
}

export async function renewRecurringPlanAction(
  planId: string,
): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await renewPlan({ planId, customerId: user.id });
  if (!ok) return { ok: false, error: "renew_failed" };
  revalidatePath("/account/recurring");
  return { ok: true, planId };
}

export async function skipRecurringVisitAction(input: {
  visitId: string;
  reason?: string | null;
}): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await skipVisit({
    visitId: input.visitId,
    customerId: user.id,
    reason: input.reason,
  });
  if (!ok) return { ok: false, error: "skip_failed" };
  revalidatePath("/account/recurring");
  return { ok: true };
}

export async function rescheduleRecurringVisitAction(input: {
  visitId: string;
  newStartsAt: string;
  note?: string | null;
}): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const ok = await rescheduleVisit({
    visitId: input.visitId,
    customerId: user.id,
    newStartsAt: input.newStartsAt,
    note: input.note,
  });
  if (!ok) return { ok: false, error: "reschedule_failed" };
  revalidatePath("/account/recurring");
  return { ok: true };
}

export async function resolveRecurringRecommendationAction(input: {
  recommendationId: string;
  accept: boolean;
}): Promise<RecurringActionResult> {
  if (!isRecurringServicesEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const result = await resolveRecommendation({
    recommendationId: input.recommendationId,
    customerId: user.id,
    accept: input.accept,
  });
  if (!result.ok) return { ok: false, error: "resolve_failed" };
  revalidatePath("/account/recurring");
  return { ok: true, planId: result.planId };
}
