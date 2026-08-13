/**
 * AI coordination — dependencies, delays, schedule recommendations.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { ProjectCoordinationHint, PackageStatus } from "./types";

function projectDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

/**
 * Recompute package blocked/ready states from dependency completion.
 */
export async function refreshProjectCoordination(
  projectId: string,
): Promise<ProjectCoordinationHint[]> {
  const admin = projectDb();
  const hints: ProjectCoordinationHint[] = [];

  const { data: packages } = await admin
    .from("project_packages")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!packages?.length) return hints;

  type PkgRow = {
    id: string;
    status: string;
    title_en: string;
    title_ar: string;
    depends_on_package_ids: string[] | null;
    metadata: Record<string, unknown> | null;
    scheduled_end: string | null;
    service_request_id: string | null;
  };

  const typedPackages = packages as PkgRow[];

  const byId = new Map(
    typedPackages.map((p) => [String(p.id), p] as const),
  );

  let completedCount = 0;

  for (const pkg of typedPackages) {
    const deps = (pkg.depends_on_package_ids ?? []) as string[];
    const unmet = deps.filter((id) => {
      const dep = byId.get(id);
      return !dep || dep.status !== "completed";
    });

    if (pkg.status === "completed") {
      completedCount += 1;
      continue;
    }

    if (unmet.length > 0) {
      if (pkg.status !== "blocked" && pkg.status !== "cancelled") {
        await admin
          .from("project_packages")
          .update({
            status: "blocked" as PackageStatus,
            updated_at: new Date().toISOString(),
            metadata: {
              ...(pkg.metadata ?? {}),
              blockedBy: unmet,
            },
          })
          .eq("id", pkg.id);
      }
      const waitTitles = unmet
        .map((id) => byId.get(id)?.title_en as string | undefined)
        .filter(Boolean)
        .join(", ");
      hints.push({
        kind: "dependency_block",
        packageId: String(pkg.id),
        messageEn: `${pkg.title_en} cannot start until ${waitTitles || "prior work"} is completed.`,
        messageAr: `لا يمكن بدء ${pkg.title_ar} قبل اكتمال العمل السابق.`,
      });
      continue;
    }

    // Dependencies met — unblock
    if (pkg.status === "blocked") {
      await admin
        .from("project_packages")
        .update({
          status: "offers",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pkg.id);

      hints.push({
        kind: "ready",
        packageId: String(pkg.id),
        messageEn: `${pkg.title_en} is ready to start — dependencies cleared.`,
        messageAr: `${pkg.title_ar} جاهز للبدء — اكتملت المتطلبات.`,
      });

      void emitAiLearningEvent({
        eventType: "project_schedule_adjusted",
        serviceRequestId: pkg.service_request_id,
        metadata: { projectId, packageId: pkg.id, reason: "deps_cleared" },
      });
    }

    // Delay detection
    if (
      pkg.scheduled_end &&
      !["completed", "cancelled"].includes(String(pkg.status))
    ) {
      const end = new Date(pkg.scheduled_end).getTime();
      if (Date.now() > end) {
        const delayHours = Math.round((Date.now() - end) / 3_600_000);
        await admin
          .from("project_packages")
          .update({
            delay_hours: delayHours,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pkg.id);

        hints.push({
          kind: "delay",
          packageId: String(pkg.id),
          messageEn: `${pkg.title_en} is delayed by ~${delayHours}h. Consider shifting later packages.`,
          messageAr: `${pkg.title_ar} متأخر بنحو ${delayHours} ساعة. يُفضَّل تأجيل الحزم اللاحقة.`,
        });

        void emitAiLearningEvent({
          eventType: "project_delay_detected",
          serviceRequestId: pkg.service_request_id,
          metadata: { projectId, packageId: pkg.id, delayHours },
        });
      }
    }
  }

  const pct = Math.round((completedCount / typedPackages.length) * 100);
  const allDone = completedCount === typedPackages.length;

  const { data: projectRow } = await admin
    .from("service_projects")
    .select("created_at, estimated_days_min, estimated_days_max")
    .eq("id", projectId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    completion_pct: pct,
    updated_at: new Date().toISOString(),
  };
  if (allDone) {
    patch.status = "completed";
    if (projectRow?.created_at) {
      const days =
        Math.round(
          ((Date.now() - new Date(projectRow.created_at).getTime()) /
            86_400_000) *
            10,
        ) / 10;
      patch.actual_duration_days = days;
      void emitAiLearningEvent({
        eventType: "project_duration_compared",
        metadata: {
          projectId,
          actualDays: days,
          estimatedMin: projectRow.estimated_days_min,
          estimatedMax: projectRow.estimated_days_max,
        },
      });
    }
    void emitAiLearningEvent({
      eventType: "project_completed",
      metadata: { projectId, packageCount: typedPackages.length },
    });
  } else if (pct > 0) {
    patch.status = "in_progress";
  }

  await admin.from("service_projects").update(patch).eq("id", projectId);

  return hints;
}

export async function markPackageStatus(input: {
  packageId: string;
  status: PackageStatus;
  customerId?: string | null;
}): Promise<boolean> {
  try {
    const admin = projectDb();
    const { data: pkg } = await admin
      .from("project_packages")
      .select("*, service_projects!inner(id, customer_id, root_service_request_id)")
      .eq("id", input.packageId)
      .maybeSingle();

    // Fallback without join if FK name differs
    let projectId: string | null = null;
    let rootRequestId: string | null = null;
    let row = pkg;

    if (!row) {
      const { data: simple } = await admin
        .from("project_packages")
        .select("*")
        .eq("id", input.packageId)
        .maybeSingle();
      row = simple;
      projectId = simple?.project_id ? String(simple.project_id) : null;
    } else {
      projectId = String(row.project_id);
    }

    if (!row || !projectId) return false;

    const { data: project } = await admin
      .from("service_projects")
      .select("customer_id, root_service_request_id")
      .eq("id", projectId)
      .maybeSingle();
    rootRequestId = project?.root_service_request_id
      ? String(project.root_service_request_id)
      : null;

    if (
      input.customerId &&
      project?.customer_id &&
      project.customer_id !== input.customerId
    ) {
      return false;
    }

    const patch: Record<string, unknown> = {
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    if (input.status === "in_progress") {
      patch.started_at = new Date().toISOString();
    }
    if (input.status === "completed") {
      patch.completed_at = new Date().toISOString();
    }

    await admin.from("project_packages").update(patch).eq("id", input.packageId);

    const learningMap: Partial<Record<PackageStatus, string>> = {
      booked: "project_package_booked",
      in_progress: "project_package_started",
      completed: "project_package_completed",
    };
    const learn = learningMap[input.status];
    if (learn) {
      void emitAiLearningEvent({
        eventType: learn as "project_package_completed",
        customerId: input.customerId,
        serviceRequestId: row.service_request_id ?? rootRequestId,
        metadata: { projectId, packageId: input.packageId },
      });
    }

    await admin.from("project_timeline_events").insert({
      project_id: projectId,
      package_id: input.packageId,
      event_key: input.status,
      label_en: `Package ${input.status.replace(/_/g, " ")}`,
      label_ar: `حالة الحزمة: ${input.status}`,
      actor: "customer",
      payload: {},
    });

    await refreshProjectCoordination(projectId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Customer-driven reorder of package execution sequence.
 */
export async function reorderProjectPackages(input: {
  projectId: string;
  orderedPackageIds: string[];
  customerId: string;
}): Promise<boolean> {
  try {
    const admin = projectDb();
    const { data: project } = await admin
      .from("service_projects")
      .select("id, customer_id, root_service_request_id, plan_version")
      .eq("id", input.projectId)
      .maybeSingle();

    if (!project || project.customer_id !== input.customerId) return false;

    for (let i = 0; i < input.orderedPackageIds.length; i++) {
      const id = input.orderedPackageIds[i];
      const dependsOn =
        i === 0 ? [] : [input.orderedPackageIds[i - 1]];
      await admin
        .from("project_packages")
        .update({
          sort_order: i + 1,
          depends_on_package_ids: dependsOn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("project_id", input.projectId);
    }

    await admin
      .from("service_projects")
      .update({
        plan_version: Number(project.plan_version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.projectId);

    await admin.from("project_timeline_events").insert({
      project_id: input.projectId,
      event_key: "plan_reordered",
      label_en: "Customer updated execution order",
      label_ar: "عدّل العميل ترتيب التنفيذ",
      actor: "customer",
      payload: { orderedPackageIds: input.orderedPackageIds },
    });

    void emitAiLearningEvent({
      eventType: "project_plan_reordered",
      customerId: input.customerId,
      serviceRequestId: project.root_service_request_id,
      metadata: { projectId: input.projectId, order: input.orderedPackageIds },
    });

    await refreshProjectCoordination(input.projectId);
    return true;
  } catch {
    return false;
  }
}
