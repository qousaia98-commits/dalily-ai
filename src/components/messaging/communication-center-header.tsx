import { getTranslations } from "next-intl/server";
import { isEnterpriseCommunicationEnabled } from "@/lib/config/feature-flags";
import { Badge } from "@/components/ui/badge";

/**
 * Communication center filters / summary strip for inbox pages.
 */
export async function CommunicationCenterHeader({
  unread,
  viewer,
}: {
  unread: number;
  viewer: "customer" | "business";
}) {
  if (!isEnterpriseCommunicationEnabled()) return null;
  const t = await getTranslations("messaging.center");

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-sm"
      role="status"
    >
      <span className="font-medium">{t("title")}</span>
      <Badge variant="secondary">
        {t("unread", { count: unread })}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {viewer === "customer" ? t("customerHint") : t("businessHint")}
      </span>
    </div>
  );
}
