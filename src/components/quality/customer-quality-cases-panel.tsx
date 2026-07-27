"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setCaseSatisfactionAction } from "@/actions/quality.actions";
import type { QualityCase } from "@/lib/quality/types";
import { QualityCaseCreateForm } from "@/components/quality/quality-case-create-form";
import { formatDateTime } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";

type Props = { cases: QualityCase[] };

export function CustomerQualityCasesPanel({ cases }: Props) {
  const t = useTranslations("quality.customer");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <QualityCaseCreateForm role="customer" />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("yourCases")}</h2>
        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {cases.map((c) => (
              <li key={c.id} className="rounded-2xl border bg-card p-4">
                <p className="text-sm font-semibold">
                  {c.caseNumber} · {t(`statuses.${c.status}`)}
                </p>
                <p className="mt-1 text-sm">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                {c.resolutionSummary ? (
                  <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    {t("resolution")}: {c.resolutionSummary}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(c.createdAt)}
                </p>
                {(c.status === "resolved" || c.status === "closed") &&
                c.satisfactionScore == null ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">{t("rateResolution")}</span>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Button
                        key={score}
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await setCaseSatisfactionAction({ caseId: c.id, score });
                            router.refresh();
                          })
                        }
                      >
                        {score}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
