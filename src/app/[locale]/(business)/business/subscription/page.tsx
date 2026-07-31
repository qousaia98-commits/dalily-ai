import { redirect } from "next/navigation";

/**
 * Sprint 10 — subscription product path retired.
 * Keep a redirect so bookmarked /business/subscription URLs do not 404.
 */
export default function BusinessSubscriptionRedirectPage() {
  redirect("/business");
}
