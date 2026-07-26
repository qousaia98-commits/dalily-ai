/** Sprint 4 Phase 5 — Recurring services types */

export type RecurringIntervalKind =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly"
  | "custom";

export type RecurringPlanStatus =
  | "draft"
  | "active"
  | "paused"
  | "cancelled"
  | "expired";

export type RecurringVisitStatus =
  | "scheduled"
  | "confirmed"
  | "skipped"
  | "rescheduled"
  | "completed"
  | "cancelled"
  | "missed";

export type RecurringPlan = {
  id: string;
  customerId: string;
  providerId: string | null;
  categorySlug: string | null;
  title: string;
  description: string | null;
  intervalKind: RecurringIntervalKind;
  customIntervalDays: number | null;
  status: RecurringPlanStatus;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  preferredWeekdays: number[];
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
  durationMinutes: number;
  timezone: string;
  locationText: string | null;
  emergencyContact: string | null;
  notes: string | null;
  nextVisitAt: string | null;
  lastVisitAt: string | null;
  renewCount: number;
  completedVisitCount: number;
  skippedVisitCount: number;
  createdAt: string;
};

export type MaintenanceContract = {
  id: string;
  planId: string;
  customerId: string;
  providerId: string | null;
  contractStart: string;
  contractEnd: string | null;
  autoRenew: boolean;
  preferredWeekdays: number[];
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
  emergencyContact: string | null;
  termsNotes: string | null;
  renewalNoticeDays: number;
};

export type RecurringVisit = {
  id: string;
  planId: string;
  bookingId: string | null;
  sequenceNumber: number;
  status: RecurringVisitStatus;
  plannedStartsAt: string;
  plannedEndsAt: string;
  skipReason: string | null;
};

export type RecurringRecommendation = {
  id: string;
  customerId: string;
  categorySlug: string | null;
  suggestedInterval: RecurringIntervalKind;
  titleEn: string;
  titleAr: string;
  reasonEn: string;
  reasonAr: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: string;
};

export type RecurringDashboard = {
  activePlans: RecurringPlan[];
  pausedPlans: RecurringPlan[];
  upcomingVisits: Array<RecurringVisit & { planTitle: string }>;
  completedVisits: Array<RecurringVisit & { planTitle: string }>;
  renewals: Array<{ planId: string; title: string; endDate: string }>;
  recommendations: RecurringRecommendation[];
  history: RecurringPlan[];
  metrics: {
    retentionHintPct: number | null;
    completionRatePct: number | null;
  };
};
