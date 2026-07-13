import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            د
          </div>
          {t("brand")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
