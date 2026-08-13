"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CollabAiSummary,
  CollaborationWorkspace,
  CollabTaskStatus,
} from "@/lib/collaboration";
import {
  acceptCollabAiRecommendationAction,
  createCollabChecklistAction,
  createCollabTaskAction,
  decideCollabApprovalAction,
  generateCollabAiSummaryAction,
  loadCollaborationWorkspaceAction,
  requestCollabApprovalAction,
  toggleCollabChecklistItemAction,
  updateCollabTaskAction,
} from "@/actions/collaboration.actions";

type Tab =
  | "overview"
  | "tasks"
  | "checklists"
  | "approvals"
  | "activity"
  | "ai";

type Props = {
  projectId: string;
};

const TASK_STATUSES: CollabTaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
];

export function CollaborationWorkspacePanel({ projectId }: Props) {
  const t = useTranslations("projects.workspace");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const [workspace, setWorkspace] = useState<CollaborationWorkspace | null>(
    null,
  );
  const [ai, setAi] = useState<CollabAiSummary | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [approvalTitle, setApprovalTitle] = useState("");

  function reload() {
    startTransition(async () => {
      const result = await loadCollaborationWorkspaceAction(projectId);
      if (!result.ok) {
        toast.error(t("loadError"));
        return;
      }
      setWorkspace(result.workspace);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per project
  }, [projectId]);

  if (!workspace) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  const p = workspace.progress;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: t("tabs.overview") },
    { id: "tasks", label: t("tabs.tasks") },
    { id: "checklists", label: t("tabs.checklists") },
    { id: "approvals", label: t("tabs.approvals") },
    { id: "activity", label: t("tabs.activity") },
    { id: "ai", label: t("tabs.ai") },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("badge")}
        </p>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              tab === item.id
                ? "bg-[var(--dalily-gold)]/15 text-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{t("progress.overall")}</span>
              <span>{p.overallPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--dalily-gold)]"
                style={{ width: `${p.overallPct}%` }}
              />
            </div>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              {t("progress.packages", {
                done: p.packagesCompleted,
                total: p.packagesTotal,
              })}
            </li>
            <li>{t("progress.tasksOpen", { count: p.tasksOpen })}</li>
            <li>{t("progress.overdue", { count: p.tasksOverdue })}</li>
            <li>{t("progress.blocked", { count: p.tasksBlocked })}</li>
            <li>
              {t("progress.approvals", { count: p.approvalsPending })}
            </li>
            <li>
              {t("progress.delayedPackages", { count: p.delayedPackages })}
            </li>
          </ul>
        </section>
      ) : null}

      {tab === "tasks" ? (
        <section className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!taskTitle.trim()) return;
              startTransition(async () => {
                const result = await createCollabTaskAction({
                  projectId,
                  title: taskTitle.trim(),
                });
                if (!result.ok) toast.error(t("taskError"));
                else {
                  toast.success(t("taskCreated"));
                  setTaskTitle("");
                  reload();
                }
              });
            }}
          >
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={t("taskPlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {t("addTask")}
            </Button>
          </form>
          <ul className="space-y-2">
            {workspace.tasks.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("tasksEmpty")}</li>
            ) : (
              workspace.tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-border/70 px-3 py-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.description ? (
                        <p className="text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}
                      {task.dueAt ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t("due", {
                            date: new Date(task.dueAt).toLocaleDateString(
                              isAr ? "ar" : "en",
                            ),
                          })}
                        </p>
                      ) : null}
                    </div>
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      value={task.status}
                      disabled={pending}
                      onChange={(e) => {
                        const status = e.target.value as CollabTaskStatus;
                        startTransition(async () => {
                          const result = await updateCollabTaskAction({
                            projectId,
                            taskId: task.id,
                            status,
                          });
                          if (!result.ok) toast.error(t("taskError"));
                          else reload();
                        });
                      }}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`taskStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "checklists" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {workspace.templates.map((tmpl) => (
              <Button
                key={tmpl.slug}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await createCollabChecklistAction({
                      projectId,
                      templateSlug: tmpl.slug,
                      locale,
                    });
                    if (!result.ok) toast.error(t("checklistError"));
                    else {
                      toast.success(t("checklistCreated"));
                      reload();
                    }
                  });
                }}
              >
                + {isAr ? tmpl.titleAr : tmpl.titleEn}
              </Button>
            ))}
          </div>
          {workspace.checklists.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("checklistsEmpty")}</p>
          ) : (
            workspace.checklists.map((list) => (
              <div
                key={list.id}
                className="space-y-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <p className="text-sm font-semibold">
                  {list.title}
                  {list.status === "completed" ? ` · ${t("completed")}` : ""}
                </p>
                <ul className="space-y-1">
                  {list.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.isDone}
                        disabled={pending}
                        onChange={(e) => {
                          startTransition(async () => {
                            const result = await toggleCollabChecklistItemAction({
                              projectId,
                              checklistId: list.id,
                              itemId: item.id,
                              isDone: e.target.checked,
                            });
                            if (!result.ok) toast.error(t("checklistError"));
                            else reload();
                          });
                        }}
                      />
                      <span
                        className={cn(
                          item.isDone && "text-muted-foreground line-through",
                        )}
                      >
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "approvals" ? (
        <section className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!approvalTitle.trim()) return;
              startTransition(async () => {
                const result = await requestCollabApprovalAction({
                  projectId,
                  kind: "quotation",
                  title: approvalTitle.trim(),
                });
                if (!result.ok) toast.error(t("approvalError"));
                else {
                  toast.success(t("approvalRequested"));
                  setApprovalTitle("");
                  reload();
                }
              });
            }}
          >
            <input
              value={approvalTitle}
              onChange={(e) => setApprovalTitle(e.target.value)}
              placeholder={t("approvalPlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {t("requestApproval")}
            </Button>
          </form>
          <ul className="space-y-2">
            {workspace.approvals.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                {t("approvalsEmpty")}
              </li>
            ) : (
              workspace.approvals.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-border/70 px-3 py-2"
                >
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`approvalKind.${a.kind}`)} · {t(`approvalStatus.${a.status}`)}
                  </p>
                  {a.status === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await decideCollabApprovalAction({
                              projectId,
                              approvalId: a.id,
                              decision: "approved",
                            });
                            if (!result.ok) toast.error(t("approvalError"));
                            else {
                              toast.success(t("approvalAccepted"));
                              reload();
                            }
                          });
                        }}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await decideCollabApprovalAction({
                              projectId,
                              approvalId: a.id,
                              decision: "rejected",
                            });
                            if (!result.ok) toast.error(t("approvalError"));
                            else {
                              toast.success(t("approvalRejected"));
                              reload();
                            }
                          });
                        }}
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section>
          <ol className="relative space-y-0 border-s border-border ps-4">
            {workspace.activity.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("activityEmpty")}</li>
            ) : (
              workspace.activity.map((ev) => (
                <li key={ev.id} className="pb-3 last:pb-0">
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
              ))
            )}
          </ol>
        </section>
      ) : null}

      {tab === "ai" ? (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("aiDisclaimer")}</p>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await generateCollabAiSummaryAction({
                  projectId,
                  locale,
                });
                if (!result.ok) toast.error(t("aiError"));
                else setAi(result.result);
              });
            }}
          >
            {t("aiGenerate")}
          </Button>
          {ai ? (
            <div className="space-y-3 rounded-xl border border-border/70 p-3 text-sm">
              <p>{ai.summary}</p>
              {ai.nextSteps.length > 0 ? (
                <div>
                  <p className="mb-1 font-semibold">{t("aiNextSteps")}</p>
                  <ul className="space-y-1">
                    {ai.nextSteps.map((step) => (
                      <li
                        key={step}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>• {step}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              await acceptCollabAiRecommendationAction({
                                projectId,
                                recommendation: step,
                              });
                              toast.success(t("aiAccepted"));
                            });
                          }}
                        >
                          {t("aiAccept")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ai.risks.length > 0 ? (
                <div>
                  <p className="mb-1 font-semibold">{t("aiRisks")}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {ai.risks.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ai.missingDocuments.length > 0 ? (
                <div>
                  <p className="mb-1 font-semibold">{t("aiMissingDocs")}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {ai.missingDocuments.map((d) => (
                      <li key={d}>• {d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
