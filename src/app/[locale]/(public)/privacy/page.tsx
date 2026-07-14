import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <article className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("updated")}</p>
          <p className="text-muted-foreground">{t("intro")}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.collect.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.collect.body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.use.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.use.body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.sharing.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.sharing.body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("sections.contact.title")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("sections.contact.body")}</p>
        </section>
      </article>
    </main>
  );
}
