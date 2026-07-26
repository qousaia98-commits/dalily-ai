"use client";

import { useLocale, useTranslations } from "next-intl";
import type { EmergencyDispatchView } from "@/lib/ai/dispatch/emergency";
import { cn } from "@/lib/utils";

const STATUS_ORDER = [
  "detected",
  "dispatching",
  "awaiting_accept",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
] as const;

type Props = {
  dispatch: EmergencyDispatchView;
  className?: string;
};

export function EmergencyStatusPanel({ dispatch, className }: Props) {
  const t = useTranslations("intentFlow.emergency");
  const locale = useLocale();
  const isAr = locale === "ar";

  const statusIndex = STATUS_ORDER.indexOf(
    dispatch.status as (typeof STATUS_ORDER)[number],
  );

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            {t("badge")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <span className="rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white">
          {t(`status.${dispatch.status}` as "status.accepted")}
        </span>
      </div>

      {dispatch.etaLabel ? (
        <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("etaLabel")}</p>
          <p className="text-base font-semibold text-foreground">
            {dispatch.etaLabel}
          </p>
          {dispatch.etaUpdatedAt ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("etaUpdated", {
                time: new Date(dispatch.etaUpdatedAt).toLocaleTimeString(
                  isAr ? "ar" : "en",
                  { hour: "2-digit", minute: "2-digit" },
                ),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {dispatch.liveLocation ? (
        <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm">
          <p className="font-medium">{t("liveLocation")}</p>
          <p className="mt-1 text-muted-foreground">
            {dispatch.liveLocation.latitude.toFixed(5)},{" "}
            {dispatch.liveLocation.longitude.toFixed(5)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("locationUpdated", {
              time: new Date(dispatch.liveLocation.recordedAt).toLocaleTimeString(
                isAr ? "ar" : "en",
                { hour: "2-digit", minute: "2-digit" },
              ),
            })}
          </p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">{t("timelineTitle")}</p>
        <ol className="relative space-y-0 border-s border-amber-500/30 ps-4">
          {dispatch.timeline.length === 0 ? (
            <li className="pb-3 text-sm text-muted-foreground">
              {t("timelineEmpty")}
            </li>
          ) : (
            dispatch.timeline.map((ev) => (
              <li key={ev.id ?? `${ev.eventKey}-${ev.createdAt}`} className="pb-4 last:pb-0">
                <span className="absolute -start-[5px] mt-1.5 size-2.5 rounded-full bg-amber-600" />
                <p className="text-sm font-medium text-foreground">
                  {isAr ? ev.labelAr : ev.labelEn}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(ev.createdAt).toLocaleString(isAr ? "ar" : "en", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </li>
            ))
          )}
        </ol>
      </div>

      {statusIndex >= 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("notified", { count: dispatch.notifiedCount })}
        </p>
      ) : null}
    </div>
  );
}
