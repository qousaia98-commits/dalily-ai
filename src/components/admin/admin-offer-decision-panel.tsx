"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  setProviderFeaturedAction,
  updateProviderStatusAction,
} from "@/actions/admin.actions";
import { loadOfferDecisionDiagnosticsAction } from "@/actions/admin-offer-decision.actions";
import type { OfferDecisionDiagnostics } from "@/lib/admin/offer-decision-diagnostics";
import { useRouter } from "@/lib/i18n/navigation";

export function AdminOfferDecisionPanel({
  providerId,
  isFeatured,
  status,
}: {
  providerId: string;
  isFeatured: boolean;
  status: string;
}) {
  const t = useTranslations("admin.offerDecision");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");
  const [diagnostics, setDiagnostics] = useState<OfferDecisionDiagnostics | null>(
    null,
  );

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      router.refresh();
    });
  };

  const loadDiagnostics = () => {
    setError(null);
    startTransition(async () => {
      const result = await loadOfferDecisionDiagnosticsAction(requestId.trim());
      if (!result.success || !result.data) {
        setError(result.error ?? "failed");
        setDiagnostics(null);
        return;
      }
      setDiagnostics(result.data);
    });
  };

  return (
    <section className="space-y-4 rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
        {t("title")}
      </h2>
      <p className="text-xs text-muted-foreground">{t("subtitle")}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          disabled={pending}
          onClick={() => run(() => setProviderFeaturedAction(providerId, !isFeatured))}
        >
          {isFeatured ? t("unfeature") : t("feature")}
        </Button>
        {status !== "suspended" ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="rounded-xl"
            disabled={pending}
            onClick={() =>
              run(() => updateProviderStatusAction(providerId, "suspended"))
            }
          >
            {t("suspendFraud")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() =>
              run(() => updateProviderStatusAction(providerId, "active"))
            }
          >
            {t("reactivate")}
          </Button>
        )}
        {isFeatured ? <Badge>{t("featuredBadge")}</Badge> : null}
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <p className="text-sm font-medium">{t("diagnosticsTitle")}</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            placeholder={t("requestIdPlaceholder")}
            className="max-w-sm rounded-xl"
            aria-label={t("requestIdPlaceholder")}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-xl"
            disabled={pending || !requestId.trim()}
            onClick={loadDiagnostics}
          >
            {t("runDiagnostics")}
          </Button>
        </div>
        {diagnostics ? (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              {t("generatedAt", { at: diagnostics.generatedAt })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("signals")}: {diagnostics.activeSignalKeys.join(", ")}
            </p>
            <ul className="space-y-1">
              {diagnostics.rows.map((row) => (
                <li
                  key={row.offerId}
                  className="rounded-xl border border-border/70 px-3 py-2"
                >
                  <span className="font-medium">
                    #{row.rank} {row.providerName ?? row.providerId}
                  </span>
                  {" · "}
                  {t("score", { score: row.recommendationScore })}
                  {" · "}
                  {row.confidence}
                  {row.isRecommended ? ` · ${t("recommended")}` : null}
                  {row.featured ? ` · ${t("featuredBadge")}` : null}
                  {row.providerStatus ? ` · ${row.providerStatus}` : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
