/** Sprint 8 Phase 4 — AI Scheduling types */

export const SCHEDULE_MODEL_VERSION = "schedule-v1";
export const SCHEDULE_ML_VERSION = "schedule-ml-v0";

export type ScheduleOptimizationGoal =
  | "balanced"
  | "min_travel"
  | "max_utilization"
  | "max_revenue"
  | "low_fatigue";

export type ScheduleWeight = {
  signalKey: string;
  category: string;
  weight: number;
  enabled: boolean;
  mlReady: boolean;
  description?: string | null;
};

export type ScheduleStop = {
  bookingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  lat: number | null;
  lng: number | null;
  locationText: string | null;
  durationMin: number;
  urgency01: number;
  categoryKey?: string | null;
};

export type ScheduleRawSignals = {
  providerId: string;
  scheduleDate: string;
  stops: ScheduleStop[];
  workingHoursStart: number;
  workingHoursEnd: number;
  maxDailyJobs: number;
  maxWeeklyJobs: number;
  jobsToday: number;
  vacationMode: boolean;
  pauseMode: boolean;
  fatigue01: number;
  traffic01: number;
  weather01: number;
  prepMinutes: number;
  cleanupMinutes: number;
  breakPreferredHour: number;
  mlScheduleFactor?: number | null;
};

export type ScheduleSignalResult = {
  signalKey: string;
  category: string;
  rawValue: number;
  score: number;
  weight: number;
  contribution: number;
  source: "rule" | "heuristic" | "ml";
};

export type PublicScheduleExplanation = {
  code: string;
  labelEn: string;
  labelAr?: string;
};

export type OptimizedStop = {
  bookingId: string;
  suggestedOrder: number;
  suggestedDeparture?: string | null;
  arrivalWindowStart?: string | null;
  arrivalWindowEnd?: string | null;
  noteEn: string;
};

export type PublicDayOptimization = {
  scheduleDate: string;
  orderedStops: OptimizedStop[];
  departureTime: string | null;
  expectedFinish: string | null;
  breakSchedule: string | null;
  lunchRecommendation: string | null;
  travelMinutes: number;
  idleMinutes: number;
  travelReductionMin: number;
  idleReductionMin: number;
  fuelReductionKm: number;
  dailyUtilization: number;
  revenueForecast: number | null;
  explanations: PublicScheduleExplanation[];
  algorithmVersion: string;
  advisoryNotice: string;
};

export type ScheduleComputation = PublicDayOptimization & {
  signals: ScheduleSignalResult[];
  latencyMs: number;
  experimentId: string | null;
  providerId: string;
  profileKey: string;
  burnoutRisk: number;
  opportunityScore: number;
  overbookingRisk: number;
};

export type ScheduleGap = {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
};

export type ScheduleOpportunity = {
  id?: string;
  titleEn: string;
  titleAr?: string;
  distanceKm: number;
  travelMinutes: number;
  expectedEarnings: number;
  expectedDurationMin: number;
  matchingScore: number;
  opportunityScore: number;
  expectedCompletion: string | null;
  currency: string;
  requestId?: string | null;
  gapStartsAt?: string | null;
  gapEndsAt?: string | null;
};

export type CapacitySnapshot = {
  maxDailyJobs: number;
  maxWeeklyJobs: number;
  jobsBooked: number;
  remainingCapacity: number;
  availableCapacity: number;
  overbookingRisk: number;
  burnoutRisk: number;
  vacationMode: boolean;
  pauseMode: boolean;
  workloadScore: number;
};

export type ProviderScheduleInsights = {
  optimization: PublicDayOptimization | null;
  capacity: CapacitySnapshot | null;
  gaps: ScheduleGap[];
  opportunities: ScheduleOpportunity[];
  route: {
    totalDistanceKm: number;
    totalTravelMin: number;
    stopOrder: string[];
  } | null;
  burnoutRisk: number;
  opportunityScore: number;
  utilization: number;
  currency: string;
};

export type CustomerScheduleHint = {
  availableWindows: string[];
  arrivalWindow: string | null;
  bookingConfidence: number;
  availabilityForecast: "scarce" | "normal" | "ample";
  explanations: PublicScheduleExplanation[];
  advisoryNotice: string;
};
