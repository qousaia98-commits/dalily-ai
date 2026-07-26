/** AI Engine Phase 3 — Smart Dispatch types. */

export type ResponseBand = "very_high" | "high" | "medium" | "low";

export type ExposureMode =
  | "immediate_dispatch"
  | "limited_pool"
  | "public_marketplace"
  | "private_invitation"
  | "emergency_broadcast";

export type EtaWindow = {
  minutesMin: number | null;
  minutesMax: number | null;
  labelEn: string;
  /** Machine-readable kind for learning. */
  kind: "minutes" | "today_slot" | "tomorrow_morning" | "unknown";
};

export type CapacityEstimate = {
  workingMinutes: number;
  bookedMinutes: number;
  travelBufferMinutes: number;
  breakMinutes: number;
  remainingMinutes: number;
  estimatedJobMinutes: number;
  overloaded: boolean;
};

export type RouteFit = {
  fits: boolean;
  nearbyBookingId: string | null;
  gapMinutes: number | null;
  distanceFromJobKm: number | null;
  labelEn: string;
};

export type ReputationBreakdown = {
  score: number;
  ratings: number;
  completion: number;
  cancellation: number;
  response: number;
  repeat: number;
  verification: number;
  reliability: number;
};

export type DispatchExplanationAudience = "customer" | "provider" | "admin";

export type DispatchExplanation = {
  audience: DispatchExplanationAudience;
  code: string;
  params?: Record<string, string | number>;
  labelEn: string;
};

export type ProviderDispatchProfile = {
  providerId: string;
  ownerId: string;
  lat: number | null;
  lng: number | null;
  verificationStatus: string;
  ratingAvg: number;
  reviewCount: number;
  acceptingRequests: boolean;
  handlesEmergency: boolean;
  estimatedResponseHours: number | null;
  todayBookings: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    lat: number | null;
    lng: number | null;
  }>;
  workingMinutesToday: number;
  isWithinWorkingHours: boolean;
};

export type DispatchScoreResult = {
  providerId: string;
  operationalScore: number;
  matchScore: number;
  reputationScore: number;
  responseBand: ResponseBand;
  responseProbability: number;
  eta: EtaWindow;
  capacity: CapacityEstimate;
  routeFit: RouteFit;
  distanceKm: number | null;
  explanations: DispatchExplanation[];
  overloaded: boolean;
};

export type DispatchPlan = {
  exposureMode: ExposureMode;
  poolSize: number;
  urgency: "emergency" | "normal";
  estimatedJobMinutes: number;
  requestLat: number | null;
  requestLng: number | null;
};
