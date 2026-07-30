import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import {
  isAiAssistantEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";

export default async function BusinessAiAssistantPage() {
  await requireAuthUser();
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) {
    redirect("/business");
  }

  const t = await getTranslations("aiPlatform.assistant");

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("providerPageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("providerPageSubtitle")}
        </p>
      </header>
      <AiAssistantPanel role="provider" />
    </div>
  );
}
