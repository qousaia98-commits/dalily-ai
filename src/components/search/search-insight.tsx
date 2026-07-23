import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";
import type { ServiceAdvisorInsight } from "@/lib/search/smart-match/advisor";
import type { CategorySlug } from "@/lib/categories/types";
import type { Locale } from "@/lib/i18n/config";
import { localizedField } from "@/lib/categories/format";
import { getLeafCategories } from "@/lib/categories/queries";

type SearchInsightProps = {
  query: string;
  problemId: ProblemId | null;
  citySlug: string | null;
  priority?: ProblemPriority | null;
  categorySlug?: CategorySlug | null;
  advisor?: ServiceAdvisorInsight | null;
  dynamicRadiusKm?: number | null;
};

export async function SearchInsight({
  query,
  problemId,
  citySlug,
  priority,
  categorySlug,
  advisor,
  dynamicRadiusKm,
}: SearchInsightProps) {
  if (!query.trim()) return null;

  const t = await getTranslations("search.insight");
  const tProblems = await getTranslations("search.problems");
  const tCities = await getTranslations("auth.cities");
  const tAdvisor = await getTranslations("search.advisor");
  const locale = (await getLocale()) as Locale;

  const hasDetection = Boolean(problemId || citySlug || advisor);
  if (!hasDetection) return null;

  let categoryLabel: string | null = null;
  if (categorySlug || advisor?.categorySlug) {
    const slug = categorySlug ?? advisor?.categorySlug;
    if (slug) {
      const leaves = await getLeafCategories();
      const match = leaves.find((leaf) => leaf.slug === slug);
      categoryLabel = match ? localizedField(match.name, locale) : slug;
    }
  }

  const urgency = priority ?? advisor?.urgency ?? null;
  const questions = advisor?.clarifyingQuestions ?? [];

  return (
    <div className="mb-6 space-y-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t("detected")}</span>
        {problemId ? <Badge variant="secondary">{tProblems(problemId)}</Badge> : null}
        {categoryLabel ? (
          <Badge variant="outline">{tAdvisor("category", { category: categoryLabel })}</Badge>
        ) : null}
        {urgency ? (
          <Badge variant="outline">{tAdvisor(`urgency.${urgency}`)}</Badge>
        ) : null}
        {citySlug ? <Badge variant="outline">{tCities(citySlug)}</Badge> : null}
        {dynamicRadiusKm != null ? (
          <Badge variant="outline">
            {tAdvisor("searchRadius", { km: dynamicRadiusKm })}
          </Badge>
        ) : null}
      </div>

      {advisor?.possibleIssueKey ? (
        <p className="text-muted-foreground">
          {tAdvisor("possibleIssue")}:{" "}
          <span className="font-medium text-foreground">
            {tAdvisor(`issues.${advisor.possibleIssueKey}`)}
          </span>
        </p>
      ) : null}

      {questions.length > 0 ? (
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground">{tAdvisor("clarifyTitle")}</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {questions.map((q) => (
              <li key={q.id}>{tAdvisor(`questions.${q.questionKey}`)}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{tAdvisor("clarifyHint")}</p>
        </div>
      ) : null}
    </div>
  );
}
