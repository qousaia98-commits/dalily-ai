import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

export default async function NotFoundPage() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">{t("code")}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="max-w-md text-muted-foreground">{t("description")}</p>
      </div>
      <Button asChild size="lg" className="rounded-xl">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
