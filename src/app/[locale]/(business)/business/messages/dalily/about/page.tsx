import { OfficialDalilyProfile } from "@/components/messaging/official-dalily-profile";
import { requireAuthUser } from "@/lib/auth/session";

export default async function BusinessDalilyAboutPage() {
  await requireAuthUser();
  return (
    <OfficialDalilyProfile
      messagesPath="/business/messages"
      namespace="business.messages"
    />
  );
}
