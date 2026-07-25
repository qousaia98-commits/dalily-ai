import { getTranslations } from "next-intl/server";
import type { UnlockSessionView } from "@/domains/unlock/types";
import type { ReleasedContact } from "@/domains/unlock/types";

export async function CustomerUnlockStatus({
  session,
  contact,
}: {
  session: UnlockSessionView | null;
  contact: ReleasedContact | null;
}) {
  const t = await getTranslations("unlockFlow.customer");

  if (!session && !contact) return null;

  if (contact) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-muted/20 px-4 py-4 text-sm">
        <p className="font-medium">{t("unlockedTitle")}</p>
        <p className="text-muted-foreground">{t("unlockedBody")}</p>
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
      </div>
    );
  }

  if (!session) return null;

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
