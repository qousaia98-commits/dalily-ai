/** Sprint 4 Phase 3 — Emergency Dispatch types */

export type EmergencyDispatchStatus =
  | "detected"
  | "dispatching"
  | "awaiting_accept"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "stopped";

export type EmergencyProviderResponse =
  | "notified"
  | "accepted"
  | "declined"
  | "busy"
  | "on_the_way"
  | "arrived"
  | "started"
  | "completed";

export type EmergencyTimelineEvent = {
  id?: string;
  eventKey: string;
  labelEn: string;
  labelAr: string;
  actor: "system" | "customer" | "provider" | "admin";
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type EmergencyDispatchView = {
  id: string;
  serviceRequestId: string;
  status: EmergencyDispatchStatus;
  activatedAt: string;
  acceptedProviderId: string | null;
  notifiedCount: number;
  acceptedCount: number;
  targetAccepts: number;
  etaMinutesMin: number | null;
  etaMinutesMax: number | null;
  etaLabel: string | null;
  etaUpdatedAt: string | null;
  timeline: EmergencyTimelineEvent[];
  liveLocation: {
    latitude: number;
    longitude: number;
    remainingKm: number | null;
    recordedAt: string;
  } | null;
};

export type EmergencyAdminDashboard = {
  version: 3;
  activeCount: number;
  avgResponseSeconds: number | null;
  avgEtaMinutes: number | null;
  successfulDispatchRatePct: number | null;
  regionalVolume: Array<{ label: string; count: number }>;
  active: Array<{
    id: string;
    serviceRequestId: string;
    status: string;
    etaLabel: string | null;
    activatedAt: string;
    categorySlug: string | null;
  }>;
};
