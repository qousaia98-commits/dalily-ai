import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { ArrowRight } from "lucide-react";

export async function WorkflowSwitchHint({
  from,
  className,
}: {
  from: "publish" | "find";
  className?: string;
}) {
  const t = await getTranslations("dualMarketplace.switch");

  const toPublish = from === "find";
  const href = toPublish
    ? "/request/new?mode=publish&from=switch"
    : "/search?from=switch";
  const title = toPublish ? t("toPublishTitle") : t("toFindTitle");
  const body = toPublish ? t("toPublishBody") : t("toFindBody");
  const cta = toPublish ? t("toPublishCta") : t("toFindCta");

  return (
    <div
      className={
        className ??
        "rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("badge")}
      </p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
      >
        {cta}
        <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
      </Link>
    </div>
  );
}
