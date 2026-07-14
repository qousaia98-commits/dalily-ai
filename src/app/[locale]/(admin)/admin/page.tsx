import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";

export default async function AdminIndexPage() {
  const locale = await getLocale();
  redirect({ href: "/admin/verification", locale });
}
