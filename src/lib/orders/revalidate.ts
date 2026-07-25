import { revalidatePath } from "next/cache";

/**
 * Shared cache invalidation after any marketplace / order status write.
 * Must include detail routes — list-only revalidation left customers on stale detail.
 */
export function revalidateOrderSurfaces(requestId?: string | null) {
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  revalidatePath("/business/requests");
  revalidatePath("/business/orders");
  revalidatePath("/business/opportunities");
  revalidatePath("/business/unlock");
  revalidatePath("/account/requests");
  revalidatePath("/account/orders");
  revalidatePath("/admin/marketplace");
  revalidatePath("/", "layout");
  revalidatePath("/business", "layout");

  if (requestId) {
    revalidatePath(`/account/requests/${requestId}`);
    revalidatePath(`/business/requests/${requestId}`);
    revalidatePath(`/request/${requestId}/waiting`);
  }
}
