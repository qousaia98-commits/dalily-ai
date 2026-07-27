"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { listEntityRelationshipsAction } from "@/actions/fraud.actions";
import type { RiskEntityType } from "@/lib/fraud/types";

type Rel = {
  id: string;
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relationshipType: string;
  confidence: number;
};

type Props = {
  entityType: RiskEntityType | string;
  entityId: string;
};

/**
 * Confirmed relationship links only — admin investigation assist.
 */
export function FraudRelationshipGraph({ entityType, entityId }: Props) {
  const t = useTranslations("admin.fraud.graph");
  const [rels, setRels] = useState<Rel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const result = await listEntityRelationshipsAction({
        entityType: entityType as RiskEntityType,
        entityId,
      });
      setRels(result.relationships);
      setLoaded(true);
    });
  }, [entityType, entityId]);

  if (!loaded) {
    return <p className="mt-2 text-xs text-muted-foreground">{t("loading")}</p>;
  }

  if (rels.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">{t("empty")}</p>;
  }

  const center = `${entityType}:${short(entityId)}`;

  return (
    <div className="mt-3 rounded-xl border border-dashed bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </p>
      <div className="mt-2 flex flex-col items-center gap-2">
        <span className="rounded-lg bg-background px-3 py-1 text-xs font-medium shadow-sm">
          {center}
        </span>
        <ul className="w-full space-y-1">
          {rels.map((r) => {
            const other =
              r.fromEntityType === entityType && r.fromEntityId === entityId
                ? `${r.toEntityType}:${short(r.toEntityId)}`
                : `${r.fromEntityType}:${short(r.fromEntityId)}`;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <span>
                  —[{r.relationshipType}]→ {other}
                </span>
                <span className="tabular-nums">
                  {Math.round(Number(r.confidence) * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function short(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}
