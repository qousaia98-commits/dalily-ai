import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <article className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("updated")}</p>
          <p className="text-muted-foreground">{t("intro")}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.service.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.service.body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.accounts.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.accounts.body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.providers.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.providers.body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.liability.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.liability.body")}</p>
        </section>
      </article>
    </main>
  );
}
