import { getTranslations } from "next-intl/server";
import { getFeaturedProviders } from "@/lib/providers/database";
import { ProviderCard } from "@/components/providers/provider-card";
import { cn } from "@/lib/utils";

export async function FeaturedProviders({ className }: { className?: string }) {
  const t = await getTranslations("home.featured");
  const providers = await getFeaturedProviders(3);

  if (providers.length === 0) {
    return null;
  }

  return (
    <section className={cn("bg-muted/30 px-4 py-16 sm:px-6 sm:py-20", className)}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center sm:text-start">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider, index) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              showMatchReasons={false}
              className={cn("animate-fade-in-up", `stagger-${index + 1}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
