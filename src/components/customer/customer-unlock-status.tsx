import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { UnlockSessionView } from "@/domains/unlock/types";
import type { ReleasedContact } from "@/domains/unlock/types";
import { Button } from "@/components/ui/button";
import { UnlockSuccessIllustration } from "@/components/illustrations";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";

export async function CustomerUnlockStatus({
  session,
  contact,
  conversationId = null,
}: {
  session: UnlockSessionView | null;
  contact: ReleasedContact | null;
  /** Sprint 7 — grant-gated full chat session id when available */
  conversationId?: string | null;
}) {
  const t = await getTranslations("unlockFlow.customer");
  const monetizationOn = isProviderMonetizationEnabled();

  if (!session && !contact) return null;

  if (contact) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-muted/20 px-4 py-4 text-sm">
        <div className="mx-auto size-24">
          <UnlockSuccessIllustration />
        </div>
        <p className="font-medium">{t("unlockedTitle")}</p>
        <p className="text-muted-foreground">
          {monetizationOn ? t("unlockedBodyFree") : t("unlockedBody")}
        </p>
        {contact.phone ? (
          <p>
            {t("phone")}:{" "}
            <a className="underline" href={`tel:${contact.phone}`}>
              {contact.phone}
            </a>
          </p>
        ) : null}
        {contact.whatsapp ? (
          <p>
            {t("whatsapp")}:{" "}
            <a
              className="underline"
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              {contact.whatsapp}
            </a>
          </p>
        ) : null}
        {!contact.phone && !contact.whatsapp ? (
          <p className="text-muted-foreground">{t("noPhoneOnFile")}</p>
        ) : null}
        {conversationId ? (
          <Button asChild className="mt-2 w-full sm:w-auto">
            <Link href={`/messages/${conversationId}`}>{t("openChat")}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  if (!session) return null;

  // Flat model: pending is a rare race — never show a customer payment prompt.
  if (monetizationOn) {
    return (
      <div className="space-y-2 rounded-2xl border border-border px-4 py-4 text-sm">
        <p className="font-medium">{t("connectingTitle")}</p>
        <p className="text-muted-foreground">{t("connectingBody")}</p>
      </div>
    );
  }

  const tStatus = await getTranslations("unlockFlow.status");

  return (
    <div className="space-y-2 rounded-2xl border border-border px-4 py-4 text-sm">
      <p className="font-medium">{t("pendingTitle")}</p>
      <p className="text-muted-foreground">{t("pendingBody")}</p>
      <p className="text-xs text-muted-foreground">
        {t("sla", { deadline: new Date(session.slaDeadline).toLocaleString() })}
      </p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {tStatus(session.status)}
      </p>
      <p className="text-xs text-muted-foreground">{t("noContactYet")}</p>
    </div>
  );
}
