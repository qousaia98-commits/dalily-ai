import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isEnterpriseCommunicationEnabled } from "@/lib/config/feature-flags";
import { listOpenConversationReports } from "@/domains/chat/communication";
import { AdminChatModerationPanel } from "@/components/admin/admin-chat-moderation-panel";
import { Megaphone } from "lucide-react";

export default async function AdminMessagesPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.chatModeration");
  const tLegacy = await getTranslations("mobilePages.adminMessages");

  if (!isEnterpriseCommunicationEnabled()) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 py-12 text-center animate-fade-in">
        <span className="flex size-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_14%,transparent)] text-[var(--dalily-gold)]">
          <Megaphone className="size-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{tLegacy("title")}</h1>
          <p className="text-muted-foreground">{tLegacy("subtitle")}</p>
        </div>
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t("enableHint")}
        </p>
      </div>
    );
  }

  const reports = await listOpenConversationReports();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 animate-fade-in sm:px-6">
      <AdminChatModerationPanel reports={reports} />
    </div>
  );
}
