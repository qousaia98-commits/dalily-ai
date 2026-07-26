/** Sprint 4 Phase 4 — Multi-Service Project types */

export type ProjectStatus =
  | "detected"
  | "planning"
  | "offers"
  | "booked"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PackageStatus =
  | "planned"
  | "matching"
  | "offers"
  | "booked"
  | "blocked"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ProjectPackageView = {
  id: string;
  tradeSlug: string;
  titleEn: string;
  titleAr: string;
  sortOrder: number;
  status: PackageStatus;
  dependsOnPackageIds: string[];
  serviceRequestId: string | null;
  assignedProviderId: string | null;
  assignedProviderName?: string | null;
  estimatedDays: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  delayHours: number | null;
  blockedReasonEn?: string | null;
  blockedReasonAr?: string | null;
};

export type ProjectTimelineEvent = {
  id?: string;
  eventKey: string;
  labelEn: string;
  labelAr: string;
  actor: "system" | "customer" | "provider" | "admin" | "ai";
  packageId?: string | null;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type ProjectCoordinationHint = {
  kind: "dependency_block" | "delay" | "reorder" | "ready";
  packageId: string;
  messageEn: string;
  messageAr: string;
};

export type ProjectDashboard = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  completionPct: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  rootServiceRequestId: string;
  customerId: string;
  packages: ProjectPackageView[];
  timeline: ProjectTimelineEvent[];
  documents: Array<{
    id: string;
    kind: string;
    fileName: string | null;
    storagePath: string;
    packageId: string | null;
    createdAt: string;
  }>;
  upcomingAppointments: Array<{
    packageId: string;
    tradeSlug: string;
    scheduledStart: string;
  }>;
  coordinationHints: ProjectCoordinationHint[];
  conversations: {
    projectWideId: string | null;
    byPackage: Record<string, string | null>;
  };
};

export type AiExecutionPlan = {
  trades: string[];
  ordered: Array<{
    tradeSlug: string;
    sortOrder: number;
    dependsOn: string[];
    titleEn: string;
    titleAr: string;
    estimatedDays: number;
  }>;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  reasonEn: string;
  reasonAr: string;
};
