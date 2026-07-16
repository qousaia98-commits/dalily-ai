import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Separator } from "@/components/ui/separator";
import { DalilyLogo } from "@/components/brand/dalily-logo";
import { cn } from "@/lib/utils";

export async function AppFooter({ className }: { className?: string } = {}) {
  const t = await getTranslations("footer");

  return (
    <footer className={cn("border-t bg-muted/20", className)}>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <DalilyLogo variant="horizontal" />
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("platform")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/search" className="transition-colors hover:text-foreground">
                  {t("links.search")}
                </Link>
              </li>
              <li>
                <Link href="/register/business" className="transition-colors hover:text-foreground">
                  {t("links.forBusiness")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("account")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/login" className="transition-colors hover:text-foreground">
                  {t("links.login")}
                </Link>
              </li>
              <li>
                <Link href="/register" className="transition-colors hover:text-foreground">
                  {t("links.register")}
                </Link>
              </li>
              <li>
                <Link href="/business" className="transition-colors hover:text-foreground">
                  {t("links.dashboard")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("legal")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                  {t("links.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-foreground">
                  {t("links.terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <p className="text-center text-sm text-muted-foreground">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
