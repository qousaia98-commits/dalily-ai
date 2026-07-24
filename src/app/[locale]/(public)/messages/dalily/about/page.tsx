import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { OfficialDalilyProfile } from "@/components/messaging/official-dalily-profile";

export default async function CustomerDalilyAboutPage() {
  const locale = await getLocale();
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect({ href: "/login", locale });
    return null;
  }

  return (
    <OfficialDalilyProfile messagesPath="/messages" namespace="customer.messages" />
  );
}
