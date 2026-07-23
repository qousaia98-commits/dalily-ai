/** Sprint 39 — Provider Success Dashboard types (AI-ready insights stubs) */

export type ProviderInsightId =
  | "complete_profile"
  | "upload_photos"
  | "slow_response"
  | "unread_bookings"
  | "unread_messages"
  | "more_hours"
  | "add_service"
  | "improve_description"
  | "verify_business"
  | "enable_availability";

export type ProviderInsight = {
  id: ProviderInsightId;
  impact: number; // 1–100, higher = show first
  href: string;
};

export type ProfileMissingItem =
  | "logo"
  | "cover"
  | "description"
  | "hours"
  | "phone"
  | "address"
  | "services"
  | "gallery"
  | "verification"
  | "category";

export type TodayAppointment = {
  bookingId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  locationText: string | null;
  locationLat: number | null;
  locationLng: number | null;
  serviceName: string | null;
  customerLabel: string;
  conversationId: string | null;
};

export type DashboardKpis = {
  todayAppointments: number;
  upcomingBookings: number;
  pendingBookingRequests: number;
  unreadMessages: number;
  averageRating: number;
  completedJobs: number;
  responseTimeHours: number | null;
  acceptanceRate: number | null;
  cancellationRate: number | null;
  profileCompletion: number;
  verificationStatus: string;
  dalilyScore: number;
};

export type PerformanceMetrics = {
  jobsThisWeek: number;
  jobsThisMonth: number;
  averageRating: number;
  reviewCount: number;
  completionRate: number | null;
  avgConfirmationTimeHours: number | null;
  avgResponseTimeHours: number | null;
  repeatCustomers: number;
  profileViews: number;
  searchAppearances: number;
  bookingConversionRate: number | null;
};

export type ChartPoint = { label: string; value: number };

export type ActivityItem = {
  id: string;
  kind:
    | "booking_created"
    | "booking_accepted"
    | "review_received"
    | "message_received"
    | "verification_approved"
    | "profile_updated"
    | "system";
  at: string;
  href: string | null;
  meta?: Record<string, string | number>;
};

export type NotificationWidgetItem = {
  id: string;
  category: "message" | "booking" | "review" | "verification" | "system";
  titleKey: string;
  bodyKey: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type AchievementId =
  | "first_booking"
  | "jobs_10"
  | "jobs_50"
  | "reviews_100"
  | "verified"
  | "fast_responder"
  | "top_rated"
  | "profile_complete";

export type Achievement = {
  id: AchievementId;
  unlocked: boolean;
  progress: number; // 0–100
};

export type ProviderLevel = {
  level: number;
  titleKey: string;
  currentScore: number;
  nextLevelAt: number;
  progressPercent: number;
};

export type ProviderSuccessDashboard = {
  kpis: DashboardKpis;
  todaySchedule: TodayAppointment[];
  performance: PerformanceMetrics;
  insights: ProviderInsight[];
  profileMissing: ProfileMissingItem[];
  activity: ActivityItem[];
  charts: {
    bookingsPerWeek: ChartPoint[];
    bookingsPerMonth: ChartPoint[];
    ratingTrend: ChartPoint[];
    completedJobsTrend: ChartPoint[];
  };
  notifications: NotificationWidgetItem[];
  unreadNotificationCount: number;
  level: ProviderLevel;
  achievements: Achievement[];
  badges: string[];
  /** Sprint 40 — modular Dalily Score breakdown */
  dalilyBreakdown: import("@/lib/dalily-ranking/types").DalilyScoreBreakdown;
  rankingTips: Array<{ component: string; tipKey: string }>;
};
