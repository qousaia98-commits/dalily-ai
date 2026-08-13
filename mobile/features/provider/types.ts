/** Provider domain types — Sprint 9 Phase 3 */

export type JobStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type ProviderJob = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  serviceTitle: string;
  status: JobStatus;
  scheduledAt: string;
  address: string;
  lat: number | null;
  lng: number | null;
  price: number;
  currency: string;
  notes: string | null;
  attachments: string[];
};

export type CalendarView = 'day' | 'week' | 'month';

export type CalendarBlock = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  kind: 'job' | 'blocked' | 'vacation' | 'working';
};

export type AvailabilityWindow = {
  weekday: number;
  start: string;
  end: string;
  recurring: boolean;
};

export type ProviderDashboard = {
  providerName: string;
  todaySchedule: ProviderJob[];
  upcomingCount: number;
  revenueToday: number;
  revenueMonth: number;
  currency: string;
  businessHealthScore: number;
  assistantSummaryEn: string;
  assistantSummaryAr: string;
  pendingRecommendations: number;
  unreadNotifications: number;
  performance: {
    completionRate: number;
    responseTimeMin: number;
    rating: number;
    capacityUsage: number;
  };
};

export type ProviderAnalytics = {
  revenue: number;
  bookings: number;
  rating: number;
  completionRate: number;
  responseTimeMin: number;
  repeatCustomers: number;
  capacityUsage: number;
  forecastDemand: number;
  pricingTrend: number;
  series: { label: string; revenue: number; bookings: number }[];
};

export type ProviderAssistantSnapshot = {
  briefingEn: string;
  briefingAr: string;
  healthScore: number;
  insights: { code: string; labelEn: string; labelAr: string; severity: string }[];
  recommendations: {
    id: string;
    code: string;
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    priority: number;
    status: 'pending' | 'accepted' | 'dismissed';
  }[];
  goals: { id: string; title: string; progressPct: number; target: number; current: number }[];
  growth: { code: string; titleEn: string; titleAr: string }[];
  benchmark: { cohort: string; percentile: number };
  history: { id: string; titleEn: string; status: string; decidedAt: string }[];
};

export type ProviderMessage = {
  id: string;
  kind: 'customer' | 'booking' | 'system' | 'ai';
  title: string;
  body: string;
  unread: boolean;
  createdAt: string;
};

export type ProviderProfileInfo = {
  businessName: string;
  aboutEn: string;
  aboutAr: string;
  services: { id: string; title: string; priceFrom: number }[];
  verified: boolean;
  trustScore: number;
  documents: { id: string; label: string; status: string }[];
  galleryCount: number;
};

export type ProviderAiInsight = {
  code: string;
  kind: 'forecast' | 'pricing' | 'scheduling' | 'matching' | 'opportunity';
  labelEn: string;
  labelAr: string;
};
