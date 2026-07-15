import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

type SearchEmptyStateProps = {
  query?: string;
};

export async function SearchEmptyState({ query }: SearchEmptyStateProps) {
  const t = await getTranslations("search");

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
        {query ? (
          <p className="text-sm font-medium text-foreground">
            {t("empty.queryLabel")}: <span className="text-primary">&ldquo;{query}&rdquo;</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
