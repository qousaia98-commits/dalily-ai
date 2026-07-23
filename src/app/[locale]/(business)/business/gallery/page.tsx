import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";

/** Legacy gallery route — media management lives at /business/media. */
export default async function BusinessGalleryRedirectPage() {
  const locale = await getLocale();
  redirect({ href: "/business/media", locale });
}
