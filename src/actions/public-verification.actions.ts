"use server";

import { getPublicVerificationSummary } from "@/lib/verification/public-summary";
import type { PublicVerificationSummary } from "@/lib/verification/public-types";

export async function getPublicVerificationSummaryAction(
  providerId: string,
): Promise<
  | { ok: true; summary: PublicVerificationSummary }
  | { ok: false; error: string }
> {
  if (!providerId || typeof providerId !== "string") {
    return { ok: false, error: "invalid" };
  }
  const summary = await getPublicVerificationSummary(providerId);
  if (!summary) return { ok: false, error: "not_found" };
  return { ok: true, summary };
}
