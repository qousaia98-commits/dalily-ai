"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeProviderPerformance } from "@/lib/search/learning";

/**
 * Admin-only: recompute performance scores for active providers (batch, capped).
 */
export async function recomputeAllPerformanceAction(): Promise<void> {
  await requireAdminUser();
  try {
    const admin = createAdminClient();
    const { data: providers } = await admin
      .from("providers")
      .select("id")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(100);

    for (const p of providers ?? []) {
      await recomputeProviderPerformance(p.id);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[recomputeAllPerformanceAction]", error);
    }
  }
  revalidatePath("/admin/learning");
}
