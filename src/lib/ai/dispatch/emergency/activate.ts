/**
 * Emergency dispatch orchestration — activate, stop, respond, ETA, timeline.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type {
  EmergencyDispatchStatus,
  EmergencyDispatchView,
  EmergencyProviderResponse,
  EmergencyTimelineEvent,
} from "./types";

const DEFAULT_TARGET_ACCEPTS = 1;
const MAX_EMERGENCY_NOTIFY = 12;

/** Untyped until database.types regenerates after migration. */
function emergencyDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

async function appendTimeline(input: {
  dispatchId: string;
  serviceRequestId: string;
  eventKey: string;
  labelEn: string;
  labelAr: string;
  actor?: EmergencyTimelineEvent["actor"];
  payload?: Record<string, unknown>;
}) {
  try {
    const admin = emergencyDb();
    await admin.from("emergency_timeline_events").insert({
      dispatch_id: input.dispatchId,
      service_request_id: input.serviceRequestId,
      event_key: input.eventKey,
      label_en: input.labelEn,
      label_ar: input.labelAr,
      actor: input.actor ?? "system",
      payload: input.payload ?? {},
    });
  } catch {
    /* soft until migration */
  }
}

/**
 * Activate emergency mode: ensure matching ran with emergency urgency,
 * create/update emergency_dispatches row, stop when target accepts met.
 */
export async function activateEmergencyDispatch(input: {
  serviceRequestId: string;
  customerId?: string | null;
}): Promise<{ dispatchId: string | null; status: EmergencyDispatchStatus }> {
  const admin = emergencyDb();

  try {
    const { data: request } = await admin
      .from("service_requests")
      .select("id, urgency, city_id, category_id, customer_id, status")
      .eq("id", input.serviceRequestId)
      .maybeSingle();

    if (!request) return { dispatchId: null, status: "cancelled" };

    // Force emergency urgency for dispatch path
    if (request.urgency !== "emergency") {
      await admin
        .from("service_requests")
        .update({ urgency: "emergency" })
        .eq("id", input.serviceRequestId);
    }

    let categorySlug: string | null = null;
    if (request.category_id) {
      const { data: cat } = await admin
        .from("categories")
        .select("slug")
        .eq("id", request.category_id as string)
        .maybeSingle();
      categorySlug = (cat?.slug as string) ?? null;
    }

    const { data: existing } = await admin
      .from("emergency_dispatches")
      .select("id, status, accepted_count, target_accepts")
      .eq("service_request_id", input.serviceRequestId)
      .maybeSingle();

    let dispatchId = (existing?.id as string) ?? null;

    if (!dispatchId) {
      const { data: created } = await admin
        .from("emergency_dispatches")
        .insert({
          service_request_id: input.serviceRequestId,
          status: "dispatching",
          target_accepts: DEFAULT_TARGET_ACCEPTS,
          city_id: request.city_id,
          category_slug: categorySlug,
        })
        .select("id")
        .single();
      dispatchId = (created?.id as string) ?? null;

      if (dispatchId) {
        await appendTimeline({
          dispatchId,
          serviceRequestId: input.serviceRequestId,
          eventKey: "emergency_detected",
          labelEn: "Emergency detected",
          labelAr: "تم اكتشاف حالة طارئة",
        });
        await appendTimeline({
          dispatchId,
          serviceRequestId: input.serviceRequestId,
          eventKey: "provider_dispatched",
          labelEn: "Providers dispatched",
          labelAr: "تم إرسال المزودين",
        });
      }

      void emitAiLearningEvent({
        eventType: "emergency_detected",
        customerId: (request.customer_id as string) ?? input.customerId,
        serviceRequestId: input.serviceRequestId,
        metadata: { categorySlug },
      });
      void emitAiLearningEvent({
        eventType: "emergency_dispatch_started",
        customerId: (request.customer_id as string) ?? input.customerId,
        serviceRequestId: input.serviceRequestId,
      });
    }

    // Run / expand matching with emergency priority
    const { runMatchingForRequest, expandMatchPool } = await import(
      "@/domains/matching"
    );
    const match = await runMatchingForRequest(input.serviceRequestId);
    if (match.assignedCount < 3 && match.poolId) {
      await expandMatchPool(input.serviceRequestId);
    }

    // Count notified assignments
    const { count: notified } = await admin
      .from("match_assignments")
      .select("id", { count: "exact", head: true })
      .eq("service_request_id", input.serviceRequestId);

    const notifiedCount = Math.min(notified ?? 0, MAX_EMERGENCY_NOTIFY);

    // Pull best ETA from top assignment
    const { data: topAssign } = await admin
      .from("match_assignments")
      .select("eta_label, response_probability")
      .eq("service_request_id", input.serviceRequestId)
      .order("rank_in_pool", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (dispatchId) {
      await admin
        .from("emergency_dispatches")
        .update({
          status: "awaiting_accept",
          notified_count: notifiedCount,
          eta_label: (topAssign?.eta_label as string) ?? "ASAP",
          eta_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", dispatchId);

      void emitAiLearningEvent({
        eventType: "emergency_provider_notified",
        serviceRequestId: input.serviceRequestId,
        metadata: { notifiedCount },
      });

      void emitAiLearningEvent({
        eventType: "eta_predicted",
        serviceRequestId: input.serviceRequestId,
        metadata: { etaLabel: topAssign?.eta_label ?? null },
      });
    }

    return {
      dispatchId,
      status: "awaiting_accept",
    };
  } catch {
    return { dispatchId: null, status: "cancelled" };
  }
}

export async function stopEmergencyDispatch(input: {
  dispatchId: string;
  reason?: string;
}): Promise<boolean> {
  try {
    const admin = emergencyDb();
    const { data } = await admin
      .from("emergency_dispatches")
      .select("id, service_request_id, activated_at, status")
      .eq("id", input.dispatchId)
      .maybeSingle();
    if (!data) return false;
    if (["stopped", "completed", "cancelled"].includes(String(data.status))) {
      return true;
    }

    const durationSec = Math.round(
      (Date.now() - new Date(data.activated_at as string).getTime()) / 1000,
    );

    const keepLifecycle = [
      "accepted",
      "on_the_way",
      "arrived",
      "in_progress",
      "completed",
    ].includes(String(data.status));

    await admin
      .from("emergency_dispatches")
      .update({
        // Keep accepted+ lifecycle; "stopped" means no further provider outreach.
        status: keepLifecycle ? data.status : "stopped",
        stopped_at: new Date().toISOString(),
        dispatch_duration_seconds: durationSec,
        updated_at: new Date().toISOString(),
        metadata: { stopReason: input.reason ?? "enough_accepts" },
      })
      .eq("id", input.dispatchId);

    await appendTimeline({
      dispatchId: input.dispatchId,
      serviceRequestId: data.service_request_id as string,
      eventKey: "dispatch_stopped",
      labelEn: "Dispatch stopped — enough providers responded",
      labelAr: "توقف الإرسال — استجاب عدد كافٍ من المزودين",
      payload: { reason: input.reason ?? "enough_accepts" },
    });

    void emitAiLearningEvent({
      eventType: "emergency_dispatch_stopped",
      serviceRequestId: data.service_request_id as string,
      metadata: { durationSec, reason: input.reason ?? "enough_accepts" },
    });

    return true;
  } catch {
    return false;
  }
}

export async function recordEmergencyProviderResponse(input: {
  serviceRequestId: string;
  providerId: string;
  assignmentId?: string | null;
  response: EmergencyProviderResponse;
  etaMinutes?: number | null;
  note?: string | null;
}): Promise<{ ok: boolean; dispatchStopped?: boolean }> {
  try {
    const admin = emergencyDb();
    const { data: dispatch } = await admin
      .from("emergency_dispatches")
      .select("*")
      .eq("service_request_id", input.serviceRequestId)
      .maybeSingle();

    if (!dispatch) return { ok: false };

    const dispatchId = dispatch.id as string;

    await admin.from("emergency_dispatch_responses").upsert(
      {
        dispatch_id: dispatchId,
        service_request_id: input.serviceRequestId,
        provider_id: input.providerId,
        assignment_id: input.assignmentId ?? null,
        response: input.response,
        responded_at: new Date().toISOString(),
        eta_minutes: input.etaMinutes ?? null,
        note: input.note ?? null,
      },
      { onConflict: "dispatch_id,provider_id,response" },
    );

    const statusMap: Partial<
      Record<EmergencyProviderResponse, EmergencyDispatchStatus>
    > = {
      accepted: "accepted",
      on_the_way: "on_the_way",
      arrived: "arrived",
      started: "in_progress",
      completed: "completed",
    };

    const labels: Record<
      EmergencyProviderResponse,
      { en: string; ar: string; event: string }
    > = {
      notified: {
        en: "Provider notified",
        ar: "تم إشعار المزود",
        event: "provider_notified",
      },
      accepted: {
        en: "Provider accepted",
        ar: "قبل المزود الطلب",
        event: "provider_accepted",
      },
      declined: {
        en: "Provider declined",
        ar: "رفض المزود الطلب",
        event: "provider_declined",
      },
      busy: {
        en: "Provider busy",
        ar: "المزود مشغول",
        event: "provider_busy",
      },
      on_the_way: {
        en: "Provider on the way",
        ar: "المزود في الطريق",
        event: "provider_on_the_way",
      },
      arrived: {
        en: "Provider arrived",
        ar: "وصل المزود",
        event: "provider_arrived",
      },
      started: {
        en: "Work started",
        ar: "بدأ العمل",
        event: "work_started",
      },
      completed: {
        en: "Completed",
        ar: "اكتمل",
        event: "completed",
      },
    };

    const label = labels[input.response];
    await appendTimeline({
      dispatchId,
      serviceRequestId: input.serviceRequestId,
      eventKey: label.event,
      labelEn: label.en,
      labelAr: label.ar,
      actor: "provider",
      payload: { providerId: input.providerId },
    });

    const learningMap: Partial<
      Record<EmergencyProviderResponse, string>
    > = {
      accepted: "emergency_accepted",
      declined: "emergency_declined",
      busy: "emergency_busy",
      on_the_way: "emergency_on_the_way",
      arrived: "emergency_arrived",
      started: "emergency_work_started",
      completed: "emergency_completed",
    };
    const learnType = learningMap[input.response];
    if (learnType) {
      void emitAiLearningEvent({
        eventType: learnType as "emergency_accepted",
        providerId: input.providerId,
        serviceRequestId: input.serviceRequestId,
        metadata: { response: input.response, etaMinutes: input.etaMinutes },
      });
    }

    let acceptedCount = Number(dispatch.accepted_count ?? 0);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.response === "accepted") {
      acceptedCount += 1;
      patch.accepted_count = acceptedCount;
      patch.accepted_provider_id = input.providerId;
      patch.accepted_assignment_id = input.assignmentId ?? null;
      patch.status = "accepted";
      if (input.etaMinutes != null) {
        patch.eta_minutes_min = Math.max(5, input.etaMinutes - 5);
        patch.eta_minutes_max = input.etaMinutes + 10;
        patch.eta_label = `${patch.eta_minutes_min}–${patch.eta_minutes_max} minutes`;
        patch.eta_updated_at = new Date().toISOString();
      }
    } else if (statusMap[input.response]) {
      // Only the accepted provider advances lifecycle
      if (
        !dispatch.accepted_provider_id ||
        dispatch.accepted_provider_id === input.providerId
      ) {
        patch.status = statusMap[input.response];
        if (input.response === "on_the_way" && input.etaMinutes != null) {
          const min = Math.max(5, input.etaMinutes - 5);
          const max = input.etaMinutes + 10;
          patch.eta_minutes_min = min;
          patch.eta_minutes_max = max;
          patch.eta_label = `${min}–${max} minutes`;
          patch.eta_updated_at = new Date().toISOString();
          void emitAiLearningEvent({
            eventType: "live_eta_updated",
            providerId: input.providerId,
            serviceRequestId: input.serviceRequestId,
            metadata: { etaLabel: patch.eta_label },
          });
        }
      }
    }

    await admin.from("emergency_dispatches").update(patch).eq("id", dispatchId);

    let dispatchStopped = false;
    const target = Number(dispatch.target_accepts ?? DEFAULT_TARGET_ACCEPTS);
    if (input.response === "accepted" && acceptedCount >= target) {
      dispatchStopped = await stopEmergencyDispatch({
        dispatchId,
        reason: "enough_accepts",
      });
    }

    return { ok: true, dispatchStopped };
  } catch {
    return { ok: false };
  }
}

export async function updateEmergencyLiveLocation(input: {
  serviceRequestId: string;
  providerId: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  sharingEnabled?: boolean;
}): Promise<boolean> {
  try {
    const admin = emergencyDb();
    const { data: dispatch } = await admin
      .from("emergency_dispatches")
      .select("id")
      .eq("service_request_id", input.serviceRequestId)
      .maybeSingle();
    if (!dispatch) return false;

    if (input.sharingEnabled === false) {
      await admin
        .from("emergency_live_locations")
        .update({
          sharing_enabled: false,
          recorded_at: new Date().toISOString(),
        })
        .eq("dispatch_id", dispatch.id)
        .eq("provider_id", input.providerId);

      void emitAiLearningEvent({
        eventType: "live_location_disabled",
        providerId: input.providerId,
        serviceRequestId: input.serviceRequestId,
      });
      return true;
    }

    // Respect provider preference when column exists
    try {
      const { data: provider } = await admin
        .from("providers")
        .select("share_live_location_enabled")
        .eq("id", input.providerId)
        .maybeSingle();
      if (provider && provider.share_live_location_enabled === false) {
        void emitAiLearningEvent({
          eventType: "live_location_disabled",
          providerId: input.providerId,
          serviceRequestId: input.serviceRequestId,
        });
        return false;
      }
    } catch {
      /* column may not exist yet */
    }

    if (input.latitude == null || input.longitude == null) return false;

    await admin.from("emergency_live_locations").upsert(
      {
        dispatch_id: dispatch.id,
        provider_id: input.providerId,
        service_request_id: input.serviceRequestId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_m: input.accuracyM ?? null,
        sharing_enabled: true,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "dispatch_id,provider_id" },
    );

    void emitAiLearningEvent({
      eventType: "live_location_shared",
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
    });

    return true;
  } catch {
    return false;
  }
}

export async function getEmergencyDispatchView(
  serviceRequestId: string,
): Promise<EmergencyDispatchView | null> {
  try {
    const admin = emergencyDb();
    const { data: dispatch } = await admin
      .from("emergency_dispatches")
      .select("*")
      .eq("service_request_id", serviceRequestId)
      .maybeSingle();
    if (!dispatch) return null;

    const { data: events } = await admin
      .from("emergency_timeline_events")
      .select("*")
      .eq("service_request_id", serviceRequestId)
      .order("created_at", { ascending: true });

    let liveLocation: EmergencyDispatchView["liveLocation"] = null;
    if (dispatch.accepted_provider_id) {
      const { data: loc } = await admin
        .from("emergency_live_locations")
        .select("*")
        .eq("dispatch_id", dispatch.id)
        .eq("provider_id", dispatch.accepted_provider_id)
        .eq("sharing_enabled", true)
        .maybeSingle();
      if (loc) {
        liveLocation = {
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          remainingKm: null,
          recordedAt: String(loc.recorded_at),
        };
      }
    }

    return {
      id: String(dispatch.id),
      serviceRequestId,
      status: dispatch.status as EmergencyDispatchStatus,
      activatedAt: String(dispatch.activated_at),
      acceptedProviderId: (dispatch.accepted_provider_id as string) ?? null,
      notifiedCount: Number(dispatch.notified_count ?? 0),
      acceptedCount: Number(dispatch.accepted_count ?? 0),
      targetAccepts: Number(dispatch.target_accepts ?? 1),
      etaMinutesMin:
        dispatch.eta_minutes_min == null
          ? null
          : Number(dispatch.eta_minutes_min),
      etaMinutesMax:
        dispatch.eta_minutes_max == null
          ? null
          : Number(dispatch.eta_minutes_max),
      etaLabel: (dispatch.eta_label as string) ?? null,
      etaUpdatedAt: (dispatch.eta_updated_at as string) ?? null,
      timeline: (events ?? []).map(
        (e: {
          id: string;
          event_key: string;
          label_en: string;
          label_ar: string;
          actor: string;
          created_at: string;
          payload?: Record<string, unknown> | null;
        }) => ({
        id: String(e.id),
        eventKey: String(e.event_key),
        labelEn: String(e.label_en),
        labelAr: String(e.label_ar),
        actor: e.actor as EmergencyTimelineEvent["actor"],
        createdAt: String(e.created_at),
        payload: (e.payload as Record<string, unknown>) ?? {},
      })),
      liveLocation,
    };
  } catch {
    return null;
  }
}
