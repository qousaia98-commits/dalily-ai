"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { assistantSuggestionFeedbackAction } from "@/actions/assistant.actions";
import type { ProactiveSuggestion } from "@/lib/ai/assistant/types";

export function AssistantSuggestionsClient({
  serviceRequestId,
  suggestions,
}: {
  serviceRequestId?: string;
  suggestions: ProactiveSuggestion[];
}) {
  const t = useTranslations("assistant.suggestions");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = suggestions.filter((s) => {
    const key = s.id ?? s.type;
    return !hidden.has(key);
  });

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("title")}</p>
      <ul className="space-y-2">
        {visible.map((s) => {
          const key = s.id ?? s.type;
          return (
            <li
              key={key}
              className="rounded-xl border border-border/70 bg-background/70 p-3 space-y-2"
            >
              <p className="text-sm font-medium">
                {isAr ? s.titleAr : s.titleEn}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAr ? s.bodyAr : s.bodyEn}
              </p>
              {s.id ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await assistantSuggestionFeedbackAction({
                          suggestionId: s.id!,
                          status: "accepted",
                          serviceRequestId,
                        });
                        setHidden((prev) => new Set(prev).add(key));
                      });
                    }}
                  >
                    {t("accept")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await assistantSuggestionFeedbackAction({
                          suggestionId: s.id!,
                          status: "ignored",
                          serviceRequestId,
                        });
                        setHidden((prev) => new Set(prev).add(key));
                      });
                    }}
                  >
                    {t("ignore")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await assistantSuggestionFeedbackAction({
                          suggestionId: s.id!,
                          status: "rejected",
                          serviceRequestId,
                        });
                        setHidden((prev) => new Set(prev).add(key));
                      });
                    }}
                  >
                    {t("reject")}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
