import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";

/** Canonical list is /account/orders — keep detail routes under /account/requests/[id]. */
export default async function CustomerRequestsRedirectPage() {
  const locale = await getLocale();
  redirect({ href: "/account/orders", locale });
}
