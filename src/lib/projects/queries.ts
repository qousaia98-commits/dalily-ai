/**
 * Project dashboard queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { refreshProjectCoordination } from "./coordinate";
import type { ProjectDashboard, PackageStatus, ProjectStatus } from "./types";

function projectDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function getProjectByRootRequest(
  rootServiceRequestId: string,
): Promise<{ id: string } | null> {
  try {
    const { data } = await projectDb()
      .from("service_projects")
      .select("id")
      .eq("root_service_request_id", rootServiceRequestId)
      .maybeSingle();
    return data?.id ? { id: String(data.id) } : null;
  } catch {
    return null;
  }
}

export async function getProjectDashboard(
  projectId: string,
  opts?: { refresh?: boolean },
): Promise<ProjectDashboard | null> {
  try {
    const coordinationHints =
      opts?.refresh === false
        ? []
        : await refreshProjectCoordination(projectId);

    const admin = projectDb();
    const { data: project } = await admin
      .from("service_projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return null;

    const [{ data: packages }, { data: events }, { data: docs }, { data: convos }] =
      await Promise.all([
        admin
          .from("project_packages")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true }),
        admin
          .from("project_timeline_events")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        admin
          .from("project_documents")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(40),
        admin
          .from("conversations")
          .select("id, package_id, chat_scope")
          .eq("project_id", projectId),
      ]);

    const providerIds = (packages ?? [])
      .map((p: { assigned_provider_id: string | null }) => p.assigned_provider_id)
      .filter(Boolean) as string[];

    const nameByProvider = new Map<string, string>();
    if (providerIds.length > 0) {
      const { data: providers } = await admin
        .from("providers")
        .select("id, display_name")
        .in("id", providerIds);
      for (const p of providers ?? []) {
        nameByProvider.set(String(p.id), String(p.display_name ?? ""));
      }
    }

    const byPackage: Record<string, string | null> = {};
    let projectWideId: string | null = null;
    for (const c of convos ?? []) {
      if (c.chat_scope === "project") projectWideId = String(c.id);
      if (c.package_id) byPackage[String(c.package_id)] = String(c.id);
    }

    const upcomingAppointments = (packages ?? [])
      .filter(
        (p: { scheduled_start: string | null; status: string }) =>
          p.scheduled_start &&
          !["completed", "cancelled"].includes(p.status),
      )
      .map(
        (p: {
          id: string;
          trade_slug: string;
          scheduled_start: string;
        }) => ({
          packageId: String(p.id),
          tradeSlug: String(p.trade_slug),
          scheduledStart: String(p.scheduled_start),
        }),
      );

    return {
      id: String(project.id),
      title: String(project.title),
      description: (project.description as string) ?? null,
      status: project.status as ProjectStatus,
      completionPct: Number(project.completion_pct ?? 0),
      estimatedDaysMin:
        project.estimated_days_min == null
          ? null
          : Number(project.estimated_days_min),
      estimatedDaysMax:
        project.estimated_days_max == null
          ? null
          : Number(project.estimated_days_max),
      rootServiceRequestId: String(project.root_service_request_id),
      customerId: String(project.customer_id),
      packages: (packages ?? []).map(
        (p: {
          id: string;
          trade_slug: string;
          title_en: string;
          title_ar: string;
          sort_order: number;
          status: string;
          depends_on_package_ids: string[] | null;
          service_request_id: string | null;
          assigned_provider_id: string | null;
          estimated_days: number | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          delay_hours: number | null;
        }) => ({
          id: String(p.id),
          tradeSlug: String(p.trade_slug),
          titleEn: String(p.title_en),
          titleAr: String(p.title_ar),
          sortOrder: Number(p.sort_order),
          status: p.status as PackageStatus,
          dependsOnPackageIds: p.depends_on_package_ids ?? [],
          serviceRequestId: p.service_request_id
            ? String(p.service_request_id)
            : null,
          assignedProviderId: p.assigned_provider_id
            ? String(p.assigned_provider_id)
            : null,
          assignedProviderName: p.assigned_provider_id
            ? nameByProvider.get(String(p.assigned_provider_id)) ?? null
            : null,
          estimatedDays:
            p.estimated_days == null ? null : Number(p.estimated_days),
          scheduledStart: p.scheduled_start
            ? String(p.scheduled_start)
            : null,
          scheduledEnd: p.scheduled_end ? String(p.scheduled_end) : null,
          delayHours: p.delay_hours == null ? null : Number(p.delay_hours),
        }),
      ),
      timeline: (events ?? []).map(
        (e: {
          id: string;
          event_key: string;
          label_en: string;
          label_ar: string;
          actor: string;
          package_id: string | null;
          created_at: string;
          payload?: Record<string, unknown>;
        }) => ({
          id: String(e.id),
          eventKey: String(e.event_key),
          labelEn: String(e.label_en),
          labelAr: String(e.label_ar),
          actor: e.actor as ProjectDashboard["timeline"][0]["actor"],
          packageId: e.package_id ? String(e.package_id) : null,
          createdAt: String(e.created_at),
          payload: e.payload ?? {},
        }),
      ),
      documents: (docs ?? []).map(
        (d: {
          id: string;
          kind: string;
          file_name: string | null;
          storage_path: string;
          package_id: string | null;
          created_at: string;
        }) => ({
          id: String(d.id),
          kind: String(d.kind),
          fileName: d.file_name,
          storagePath: String(d.storage_path),
          packageId: d.package_id ? String(d.package_id) : null,
          createdAt: String(d.created_at),
        }),
      ),
      upcomingAppointments,
      coordinationHints,
      conversations: { projectWideId, byPackage },
    };
  } catch {
    return null;
  }
}

/**
 * Ensure project-wide or package chat conversation exists (separated scopes).
 */
export async function ensureProjectConversation(input: {
  projectId: string;
  customerId: string;
  providerId: string;
  packageId?: string | null;
  serviceRequestId?: string | null;
}): Promise<string | null> {
  try {
    const admin = projectDb();
    const scope = input.packageId ? "package" : "project";

    let query = admin
      .from("conversations")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("provider_id", input.providerId)
      .eq("customer_id", input.customerId)
      .eq("chat_scope", scope);

    if (input.packageId) {
      query = query.eq("package_id", input.packageId);
    } else {
      query = query.is("package_id", null);
    }

    const { data: existing } = await query.maybeSingle();
    if (existing?.id) return String(existing.id);

    const { data: created } = await admin
      .from("conversations")
      .insert({
        provider_id: input.providerId,
        customer_id: input.customerId,
        service_request_id: input.serviceRequestId ?? null,
        project_id: input.projectId,
        package_id: input.packageId ?? null,
        chat_scope: scope,
      })
      .select("id")
      .single();

    return created?.id ? String(created.id) : null;
  } catch {
    return null;
  }
}
