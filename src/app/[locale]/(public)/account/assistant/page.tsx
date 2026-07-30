import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import {
  isAiAssistantEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";

export default async function AccountAiAssistantPage() {
  await requireAuthUser();
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) {
    redirect("/account");
  }

  const t = await getTranslations("aiPlatform.assistant");

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8 animate-fade-in sm:px-0">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </header>
      <AiAssistantPanel role="customer" />
    </div>
  );
}
