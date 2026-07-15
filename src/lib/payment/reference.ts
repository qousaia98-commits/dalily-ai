import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Immutable unique payment reference, e.g. DAL-7A92F4C1 */
export function generatePaymentReference(): string {
  return `DAL-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Allocate a unique reference, retrying on rare collisions. */
export async function allocateUniquePaymentReference(maxAttempts = 8): Promise<string> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reference = generatePaymentReference();
    const { data } = await admin
      .from("payments")
      .select("id")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!data) return reference;
  }

  throw new Error("payment_reference_allocation_failed");
}
