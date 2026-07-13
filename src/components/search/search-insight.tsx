import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { ProblemId } from "@/lib/search/engine/types";

type SearchInsightProps = {
  query: string;
  problemId: ProblemId | null;
  citySlug: string | null;
};

export async function SearchInsight({ query, problemId, citySlug }: SearchInsightProps) {
  if (!query.trim()) return null;

  const t = await getTranslations("search.insight");
  const tProblems = await getTranslations("search.problems");
  const tCities = await getTranslations("auth.cities");

  const hasDetection = Boolean(problemId || citySlug);
  if (!hasDetection) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{t("detected")}</span>
      {problemId ? <Badge variant="secondary">{tProblems(problemId)}</Badge> : null}
      {citySlug ? <Badge variant="outline">{tCities(citySlug)}</Badge> : null}
    </div>
  );
}
