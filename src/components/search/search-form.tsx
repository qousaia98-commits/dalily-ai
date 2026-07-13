"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

type SearchFormProps = {
  defaultQuery?: string;
  className?: string;
  size?: "default" | "compact";
};

export function SearchForm({ defaultQuery = "", className, size = "default" }: SearchFormProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [error, setError] = useState<string | null>(null);

  const isCompact = size === "compact";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setError(t("errors.tooShort"));
      return;
    }

    if (trimmed.length > MAX_QUERY_LENGTH) {
      setError(t("errors.tooLong"));
      return;
    }

    setError(null);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (error) setError(null);
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "search-error" : undefined}
            maxLength={MAX_QUERY_LENGTH}
            className={cn(
              "rounded-2xl border-border/80 bg-card ps-12 pe-4 shadow-lg shadow-primary/5 transition-shadow focus-visible:shadow-xl focus-visible:shadow-primary/10",
              isCompact ? "h-12 text-base" : "h-14 text-base sm:h-16 sm:text-lg",
            )}
          />
          {error ? (
            <p id="search-error" role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          size="lg"
          className={cn(
            "w-full rounded-2xl px-8 font-semibold shadow-lg shadow-primary/20 sm:w-auto",
            isCompact ? "h-12 text-base" : "h-14 text-base sm:h-16",
          )}
        >
          <Sparkles className="size-5" />
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
