"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import dynamic from "next/dynamic";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { ProjectDashboard } from "@/lib/projects";
import {
  reorderProjectPackagesAction,
  updateProjectPackageStatusAction,
} from "@/actions/project.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isCollaborationWorkspaceEnabled } from "@/lib/config/feature-flags";

const ProjectMediaGallery = dynamic(
  () =>
    import("@/components/projects/project-media-gallery").then(
      (m) => m.ProjectMediaGallery,
    ),
  { ssr: false },
);

const CollaborationWorkspacePanel = dynamic(
  () =>
    import("@/components/projects/collaboration-workspace-panel").then(
      (m) => m.CollaborationWorkspacePanel,
    ),
  { ssr: false },
);

type Props = {
  project: ProjectDashboard;
  compact?: boolean;
};

export function ProjectDashboardPanel({ project, compact }: Props) {
  const t = useTranslations("projects.dashboard");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [pending, startTransition] = useTransition();

  function move(index: number, dir: -1 | 1) {
    const ids = project.packages.map((p) => p.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    startTransition(async () => {
      const result = await reorderProjectPackagesAction({
        projectId: project.id,
        orderedPackageIds: next,
      });
      if (!result.ok) toast.error(t("reorderError"));
      else toast.success(t("reorderSuccess"));
    });
  }

  function markComplete(packageId: string) {
    startTransition(async () => {
      const result = await updateProjectPackageStatusAction({
        projectId: project.id,
        packageId,
        status: "completed",
      });
      if (!result.ok) toast.error(t("statusError"));
      else toast.success(t("packageCompleted"));
    });
  }

  return (
    <div
      className={cn(
        "space-y-5 rounded-2xl border border-border bg-card p-4",
        compact && "space-y-3 p-3",
      )}
    >
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("badge")}
        </p>
        <h2 className="text-lg font-semibold">{project.title}</h2>
        <p className="text-sm text-muted-foreground">
          {t("progress", { pct: project.completionPct })} ·{" "}
          {t(`status.${project.status}` as "status.planning")}
        </p>
        {project.estimatedDaysMin != null ? (
          <p className="text-xs text-muted-foreground">
            {t("estimate", {
              min: project.estimatedDaysMin,
              max: project.estimatedDaysMax ?? project.estimatedDaysMin,
            })}
          </p>
        ) : null}
      </header>

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{t("completion")}</span>
          <span>{project.completionPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[var(--dalily-gold)] transition-all"
            style={{ width: `${project.completionPct}%` }}
          />
        </div>
      </div>

      {project.coordinationHints.length > 0 ? (
        <ul className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          {project.coordinationHints.slice(0, 4).map((h) => (
            <li key={`${h.packageId}-${h.kind}`} className="text-muted-foreground">
              • {isAr ? h.messageAr : h.messageEn}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("packages")}</h3>
        <ol className="space-y-2">
          {project.packages.map((pkg, idx) => (
            <li
              key={pkg.id}
              className="rounded-xl border border-border/70 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {pkg.sortOrder}. {isAr ? pkg.titleAr : pkg.titleEn}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`packageStatus.${pkg.status}` as "packageStatus.planned")}
                    {pkg.assignedProviderName
                      ? ` · ${pkg.assignedProviderName}`
                      : ""}
                    {pkg.estimatedDays != null
                      ? ` · ~${pkg.estimatedDays}d`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {!compact ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || idx === 0}
                        onClick={() => move(idx, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || idx === project.packages.length - 1}
                        onClick={() => move(idx, 1)}
                      >
                        ↓
                      </Button>
                    </>
                  ) : null}
                  {pkg.status !== "completed" && !compact ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending || pkg.status === "blocked"}
                      onClick={() => markComplete(pkg.id)}
                    >
                      {t("markDone")}
                    </Button>
                  ) : null}
                  {pkg.serviceRequestId ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/request/${pkg.serviceRequestId}/waiting`}>
                        {t("openPackage")}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!compact ? (
        <>
          {project.upcomingAppointments.length > 0 ? (
            <section className="space-y-1">
              <h3 className="text-sm font-semibold">{t("appointments")}</h3>
              <ul className="text-sm text-muted-foreground">
                {project.upcomingAppointments.map((a) => (
                  <li key={a.packageId}>
                    {a.tradeSlug}:{" "}
                    {new Date(a.scheduledStart).toLocaleString(
                      isAr ? "ar" : "en",
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("timeline")}</h3>
            <ol className="relative space-y-0 border-s border-border ps-4">
              {project.timeline.map((ev) => (
                <li
                  key={ev.id ?? `${ev.eventKey}-${ev.createdAt}`}
                  className="pb-3 last:pb-0"
                >
                  <span className="absolute -start-[5px] mt-1.5 size-2.5 rounded-full bg-[var(--dalily-gold)]" />
                  <p className="text-sm font-medium">
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
              ))}
            </ol>
          </section>

          <section className="space-y-1">
            <h3 className="text-sm font-semibold">{t("documents")}</h3>
            {project.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("documentsEmpty")}</p>
            ) : (
              <ul className="text-sm text-muted-foreground">
                {project.documents.slice(0, 8).map((d) => (
                  <li key={d.id}>
                    {d.kind}: {d.fileName ?? d.storagePath}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ProjectMediaGallery
            projectId={project.id}
            packages={project.packages.map((p) => ({
              id: p.id,
              title: isAr ? p.titleAr : p.titleEn,
            }))}
          />

          {isCollaborationWorkspaceEnabled() ? (
            <CollaborationWorkspacePanel projectId={project.id} />
          ) : null}

          <section className="space-y-1">
            <h3 className="text-sm font-semibold">{t("messages")}</h3>
            <p className="text-sm text-muted-foreground">{t("messagesHint")}</p>
          </section>
        </>
      ) : (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/account/projects/${project.id}`}>{t("openFull")}</Link>
        </Button>
      )}
    </div>
  );
}
