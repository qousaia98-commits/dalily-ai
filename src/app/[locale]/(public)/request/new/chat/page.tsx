import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  isAiPlatformEnabled,
  isCustomerIntentFlowV2Enabled,
} from "@/lib/config/feature-flags";
import { AiIntakeChat } from "@/components/customer/ai-intake-chat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("intakeChat");
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

/**
 * Full-screen AI intake chat — clarifies the problem, then hands off to
 * `/request/new?q=` (existing intake). Guests allowed.
 */
export default async function IntakeChatPage() {
  if (!isCustomerIntentFlowV2Enabled()) {
    redirect("/");
  }
  if (!isAiPlatformEnabled()) {
    redirect("/request/new");
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <AiIntakeChat />
    </main>
  );
}
