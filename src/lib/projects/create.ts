/**
 * Create multi-service project + packages + child requests + matching.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { analyzeJob } from "@/lib/ai/jobs/analyze";
import { buildAiExecutionPlan, detectProjectKind } from "./plan";
import type { AiExecutionPlan } from "./types";

function projectDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

async function appendTimeline(input: {
  projectId: string;
  packageId?: string | null;
  eventKey: string;
  labelEn: string;
  labelAr: string;
  actor?: "system" | "customer" | "provider" | "admin" | "ai";
  payload?: Record<string, unknown>;
}) {
  try {
    await projectDb().from("project_timeline_events").insert({
      project_id: input.projectId,
      package_id: input.packageId ?? null,
      event_key: input.eventKey,
      label_en: input.labelEn,
      label_ar: input.labelAr,
      actor: input.actor ?? "system",
      payload: input.payload ?? {},
    });
  } catch {
    /* soft */
  }
}

async function resolveCategoryId(tradeSlug: string): Promise<string | null> {
  const admin = projectDb();
  const { data } = await admin
    .from("categories")
    .select("id")
    .eq("slug", tradeSlug)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * Detect multi-service need and create parent project with trade packages.
 * Returns null when single-service.
 */
export async function createMultiServiceProject(input: {
  rootServiceRequestId: string;
  customerId: string;
  intentText: string;
  primaryCategorySlug: string;
  cityId?: string | null;
  urgency?: string | null;
  locationText?: string | null;
  runMatching?: boolean;
}): Promise<{
  projectId: string;
  plan: AiExecutionPlan;
  packageCount: number;
} | null> {
  const analysis = analyzeJob({
    text: input.intentText,
    categorySlug: input.primaryCategorySlug,
    emergency: input.urgency === "emergency",
  });

  const kind = detectProjectKind(input.intentText);
  const related =
    analysis?.relatedTrades?.length
      ? analysis.relatedTrades
      : kind.isMulti
        ? kind.kind === "bathroom"
          ? ["plumbing", "electrical", "carpentry", "painting"].filter(
              (t) => t !== input.primaryCategorySlug,
            )
          : kind.kind === "kitchen"
            ? ["plumbing", "electrical", "carpentry", "painting"].filter(
                (t) => t !== input.primaryCategorySlug,
              )
            : ["plumbing", "carpentry", "painting"].filter(
                (t) => t !== input.primaryCategorySlug,
              )
        : [];

  const isMulti =
    Boolean(analysis?.multiService && related.length > 0) ||
    (kind.isMulti && related.length > 0);

  if (!isMulti) return null;

  const plan = buildAiExecutionPlan({
    primaryTrade: input.primaryCategorySlug,
    relatedTrades: related,
    text: input.intentText,
  });

  if (plan.ordered.length < 2) return null;

  const admin = projectDb();

  const { data: existing } = await admin
    .from("service_projects")
    .select("id")
    .eq("root_service_request_id", input.rootServiceRequestId)
    .maybeSingle();
  if (existing?.id) {
    return {
      projectId: String(existing.id),
      plan,
      packageCount: plan.ordered.length,
    };
  }

  const title =
    kind.kind === "bathroom"
      ? "Bathroom renovation"
      : kind.kind === "kitchen"
        ? "Kitchen renovation"
        : kind.kind === "water_damage"
          ? "Water damage restoration"
          : analysis?.serviceKey?.replace(/\./g, " ") || "Multi-service project";

  void emitAiLearningEvent({
    eventType: "project_detected",
    customerId: input.customerId,
    serviceRequestId: input.rootServiceRequestId,
    metadata: { kind: kind.kind, trades: plan.trades },
  });

  const { data: project, error } = await admin
    .from("service_projects")
    .insert({
      customer_id: input.customerId,
      root_service_request_id: input.rootServiceRequestId,
      title,
      description: input.intentText.slice(0, 2000),
      status: "planning",
      city_id: input.cityId ?? null,
      urgency: input.urgency ?? null,
      estimated_days_min: plan.estimatedDaysMin,
      estimated_days_max: plan.estimatedDaysMax,
      metadata: {
        kind: kind.kind,
        planReasonEn: plan.reasonEn,
        planReasonAr: plan.reasonAr,
      },
    })
    .select("id")
    .single();

  if (error || !project?.id) return null;
  const projectId = String(project.id);

  await appendTimeline({
    projectId,
    eventKey: "created",
    labelEn: "Project created",
    labelAr: "تم إنشاء المشروع",
  });
  await appendTimeline({
    projectId,
    eventKey: "planning",
    labelEn: "AI execution plan ready",
    labelAr: "خطة التنفيذ جاهزة",
    actor: "ai",
    payload: { trades: plan.trades },
  });

  void emitAiLearningEvent({
    eventType: "project_created",
    customerId: input.customerId,
    serviceRequestId: input.rootServiceRequestId,
    metadata: { projectId, packageCount: plan.ordered.length },
  });
  void emitAiLearningEvent({
    eventType: "project_plan_generated",
    customerId: input.customerId,
    serviceRequestId: input.rootServiceRequestId,
    metadata: {
      projectId,
      ordered: plan.ordered.map((p) => p.tradeSlug),
      estimatedDaysMin: plan.estimatedDaysMin,
      estimatedDaysMax: plan.estimatedDaysMax,
    },
  });

  // Insert packages first without deps, then wire depends_on by id
  const packageIdsByTrade = new Map<string, string>();

  for (const step of plan.ordered) {
    let serviceRequestId: string | null = null;

    if (step.tradeSlug === input.primaryCategorySlug) {
      serviceRequestId = input.rootServiceRequestId;
    } else {
      const categoryId = await resolveCategoryId(step.tradeSlug);
      const { data: child } = await admin
        .from("service_requests")
        .insert({
          customer_id: input.customerId,
          provider_id: null,
          title: `${title} — ${step.titleEn}`,
          description: `${input.intentText}\n\n[Project package: ${step.tradeSlug}]`,
          intent_text: input.intentText,
          location_text: input.locationText ?? null,
          status: "pending",
          lifecycle_version: 2,
          category_id: categoryId,
          city_id: input.cityId ?? null,
          urgency: input.urgency ?? "normal",
          category_confirmed: true,
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      serviceRequestId = (child?.id as string) ?? null;
    }

    const { data: pkg } = await admin
      .from("project_packages")
      .insert({
        project_id: projectId,
        service_request_id: serviceRequestId,
        trade_slug: step.tradeSlug,
        title_en: step.titleEn,
        title_ar: step.titleAr,
        sort_order: step.sortOrder,
        status: "matching",
        estimated_days: step.estimatedDays,
        metadata: { dependsOnTrades: step.dependsOn },
      })
      .select("id")
      .single();

    if (pkg?.id) {
      packageIdsByTrade.set(step.tradeSlug, String(pkg.id));
    }
  }

  // Wire dependency UUIDs
  for (const step of plan.ordered) {
    const pkgId = packageIdsByTrade.get(step.tradeSlug);
    if (!pkgId) continue;
    const depIds = step.dependsOn
      .map((t) => packageIdsByTrade.get(t))
      .filter((x): x is string => Boolean(x));
    await admin
      .from("project_packages")
      .update({
        depends_on_package_ids: depIds,
        status: depIds.length > 0 ? "blocked" : "matching",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pkgId);

    if (depIds.length > 0) {
      await appendTimeline({
        projectId,
        packageId: pkgId,
        eventKey: "dependency",
        labelEn: `${step.titleEn} waits for prior packages`,
        labelAr: `${step.titleAr} ينتظر الحزم السابقة`,
        actor: "ai",
      });
      void emitAiLearningEvent({
        eventType: "project_dependency_blocked",
        customerId: input.customerId,
        serviceRequestId: input.rootServiceRequestId,
        metadata: { packageId: pkgId, dependsOn: depIds },
      });
    }
  }

  await admin
    .from("service_projects")
    .update({ status: "offers", updated_at: new Date().toISOString() })
    .eq("id", projectId);

  await appendTimeline({
    projectId,
    eventKey: "offers",
    labelEn: "Matching providers per package",
    labelAr: "مطابقة مزودين لكل حزمة",
  });

  // Ensure project-wide conversation stub row isn't required; chat opens later.
  // Matching per package request
  if (input.runMatching !== false) {
    try {
      const { isMatchingV2Enabled } = await import(
        "@/lib/config/feature-flags"
      );
      if (isMatchingV2Enabled()) {
        const { runMatchingForRequest } = await import("@/domains/matching");
        const { data: pkgs } = await admin
          .from("project_packages")
          .select("id, service_request_id, status")
          .eq("project_id", projectId);

        for (const pkg of pkgs ?? []) {
          if (!pkg.service_request_id) continue;
          // Match even blocked packages so offers can be collected early;
          // coordination still gates "start work".
          try {
            await runMatchingForRequest(String(pkg.service_request_id));
            void emitAiLearningEvent({
              eventType: "project_package_matched",
              customerId: input.customerId,
              serviceRequestId: String(pkg.service_request_id),
              metadata: { projectId, packageId: pkg.id },
            });
            await admin
              .from("project_packages")
              .update({
                status:
                  pkg.status === "blocked" ? "blocked" : "offers",
                updated_at: new Date().toISOString(),
              })
              .eq("id", pkg.id);
          } catch {
            /* best-effort per package */
          }
        }
      }
    } catch {
      /* matching optional */
    }
  }

  return {
    projectId,
    plan,
    packageCount: plan.ordered.length,
  };
}
