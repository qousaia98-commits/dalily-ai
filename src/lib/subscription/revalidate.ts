import { revalidatePath } from "next/cache";

/**
 * Revalidate every surface that depends on subscription / plan state.
 * Call after approve, reject, change plan, cancel, expire, or receipt submit.
 */
export function revalidateSubscriptionSurfaces(options?: {
  providerSlug?: string | null;
}) {
  revalidatePath("/business", "layout");
  revalidatePath("/business/subscription");
  revalidatePath("/business/analytics");
  revalidatePath("/business/welcome");
  revalidatePath("/business/messages");
  revalidatePath("/business/profile");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/providers");
  revalidatePath("/search");
  revalidatePath("/", "layout");

  if (options?.providerSlug) {
    revalidatePath(`/providers/${options.providerSlug}`);
  }
}
