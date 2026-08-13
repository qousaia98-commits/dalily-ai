import type {
  AvailabilityWindow,
  CalendarBlock,
  ProviderAiInsight,
  ProviderAnalytics,
  ProviderAssistantSnapshot,
  ProviderDashboard,
  ProviderJob,
  ProviderMessage,
  ProviderProfileInfo,
} from '@/features/provider/types';

export const DEMO_JOBS: ProviderJob[] = [
  {
    id: 'job-1',
    customerName: 'Sara H.',
    customerPhone: '+962700000001',
    serviceTitle: 'Home cleaning',
    status: 'upcoming',
    scheduledAt: new Date(Date.now() + 2 * 3600000).toISOString(),
    address: 'Abdoun, Amman',
    lat: 31.95,
    lng: 35.88,
    price: 25,
    currency: 'JOD',
    notes: 'Bring eco products',
    attachments: [],
  },
  {
    id: 'job-2',
    customerName: 'Omar K.',
    customerPhone: '+962700000002',
    serviceTitle: 'AC service',
    status: 'active',
    scheduledAt: new Date().toISOString(),
    address: 'Jabal Amman',
    lat: 31.95,
    lng: 35.93,
    price: 35,
    currency: 'JOD',
    notes: null,
    attachments: [],
  },
  {
    id: 'job-3',
    customerName: 'Lina M.',
    customerPhone: null,
    serviceTitle: 'Deep cleaning',
    status: 'completed',
    scheduledAt: new Date(Date.now() - 86400000).toISOString(),
    address: 'Sweifieh',
    lat: null,
    lng: null,
    price: 40,
    currency: 'JOD',
    notes: 'Done early',
    attachments: [],
  },
  {
    id: 'job-4',
    customerName: 'Rami A.',
    customerPhone: '+962700000004',
    serviceTitle: 'Plumbing check',
    status: 'cancelled',
    scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    address: 'Zarqa',
    lat: null,
    lng: null,
    price: 20,
    currency: 'JOD',
    notes: 'Customer cancelled',
    attachments: [],
  },
  {
    id: 'job-5',
    customerName: 'Nour S.',
    customerPhone: '+962700000005',
    serviceTitle: 'Garden trim',
    status: 'rescheduled',
    scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    address: 'Khalda',
    lat: 31.99,
    lng: 35.84,
    price: 30,
    currency: 'JOD',
    notes: 'Moved to Friday',
    attachments: [],
  },
];

export function demoDashboard(): ProviderDashboard {
  const today = DEMO_JOBS.filter((j) => j.status === 'upcoming' || j.status === 'active');
  return {
    providerName: 'Amman Clean Pros',
    todaySchedule: today,
    upcomingCount: DEMO_JOBS.filter((j) => j.status === 'upcoming').length,
    revenueToday: 60,
    revenueMonth: 1840,
    currency: 'JOD',
    businessHealthScore: 0.78,
    assistantSummaryEn:
      'Health 78%. Fill evening gaps and keep response under 30 minutes.',
    assistantSummaryAr:
      'الصحة 78٪. املأ فجوات المساء وحافظ على الاستجابة تحت 30 دقيقة.',
    pendingRecommendations: 3,
    unreadNotifications: 4,
    performance: {
      completionRate: 0.86,
      responseTimeMin: 14,
      rating: 4.8,
      capacityUsage: 0.62,
    },
  };
}

export function demoAssistant(): ProviderAssistantSnapshot {
  return {
    briefingEn:
      'Good morning. 2 jobs on the board today. Busy 09:00–12:00 and 17:00–20:00.',
    briefingAr:
      'صباح الخير. عملان اليوم. الذروة 09:00–12:00 و 17:00–20:00.',
    healthScore: 0.78,
    insights: [
      {
        code: 'response_improved',
        labelEn: 'Your response time improved by about 18%.',
        labelAr: 'تحسّن زمن استجابتك بنحو 18٪.',
        severity: 'positive',
      },
      {
        code: 'weekend_demand',
        labelEn: 'Weekend demand is increasing.',
        labelAr: 'طلب نهاية الأسبوع في ارتفاع.',
        severity: 'info',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        code: 'evening_bookings',
        titleEn: 'Accept more evening bookings',
        titleAr: 'اقبل المزيد من حجوزات المساء',
        bodyEn: 'Idle capacity in evenings raises utilization.',
        priority: 0.9,
        status: 'pending',
      },
      {
        id: 'rec-2',
        code: 'friday_availability',
        titleEn: 'Increase availability on Fridays',
        titleAr: 'زِد التوفر يوم الجمعة',
        bodyEn: 'Friday demand outpaces your open slots.',
        priority: 0.8,
        status: 'pending',
      },
      {
        id: 'rec-3',
        code: 'verification',
        titleEn: 'Complete verification',
        titleAr: 'أكمل التوثيق',
        bodyEn: 'Verified badges lift conversion.',
        priority: 0.7,
        status: 'pending',
      },
    ],
    goals: [
      { id: 'g1', title: 'Monthly revenue', progressPct: 0.61, target: 3000, current: 1840 },
      { id: 'g2', title: 'Avg rating', progressPct: 0.96, target: 5, current: 4.8 },
    ],
    growth: [
      {
        code: 'nearby_region',
        titleEn: 'Test a nearby expansion region',
        titleAr: 'جرّب منطقة توسّع قريبة',
      },
      {
        code: 'premium',
        titleEn: 'Offer a premium same-day option',
        titleAr: 'قدّم خياراً مميزاً في نفس اليوم',
      },
    ],
    benchmark: { cohort: 'above_average', percentile: 0.72 },
    history: [
      {
        id: 'h1',
        titleEn: 'Improve response time',
        status: 'accepted',
        decidedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  };
}

export function demoAnalytics(): ProviderAnalytics {
  return {
    revenue: 1840,
    bookings: 42,
    rating: 4.8,
    completionRate: 0.86,
    responseTimeMin: 14,
    repeatCustomers: 11,
    capacityUsage: 0.62,
    forecastDemand: 0.71,
    pricingTrend: 0.58,
    series: [
      { label: 'Mon', revenue: 220, bookings: 5 },
      { label: 'Tue', revenue: 180, bookings: 4 },
      { label: 'Wed', revenue: 260, bookings: 6 },
      { label: 'Thu', revenue: 210, bookings: 5 },
      { label: 'Fri', revenue: 310, bookings: 7 },
      { label: 'Sat', revenue: 290, bookings: 8 },
      { label: 'Sun', revenue: 170, bookings: 3 },
    ],
  };
}

export function demoCalendarBlocks(): CalendarBlock[] {
  return DEMO_JOBS.filter((j) => j.status !== 'cancelled').map((j) => ({
    id: `cal-${j.id}`,
    title: j.serviceTitle,
    startAt: j.scheduledAt,
    endAt: new Date(new Date(j.scheduledAt).getTime() + 90 * 60000).toISOString(),
    kind: j.status === 'upcoming' || j.status === 'active' ? 'job' : 'job',
  }));
}

export const DEMO_AVAILABILITY: AvailabilityWindow[] = [
  { weekday: 0, start: '09:00', end: '17:00', recurring: true },
  { weekday: 1, start: '09:00', end: '17:00', recurring: true },
  { weekday: 2, start: '09:00', end: '17:00', recurring: true },
  { weekday: 3, start: '09:00', end: '17:00', recurring: true },
  { weekday: 4, start: '09:00', end: '20:00', recurring: true },
  { weekday: 5, start: '10:00', end: '16:00', recurring: true },
];

export const DEMO_MESSAGES: ProviderMessage[] = [
  {
    id: 'm1',
    kind: 'customer',
    title: 'Sara H.',
    body: 'Can you arrive a bit earlier?',
    unread: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm2',
    kind: 'booking',
    title: 'Booking update',
    body: 'Omar K. confirmed the AC service.',
    unread: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm3',
    kind: 'ai',
    title: 'AI briefing ready',
    body: 'Your morning briefing has new evening recommendations.',
    unread: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'm4',
    kind: 'system',
    title: 'Verification',
    body: 'Document review is in progress.',
    unread: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const DEMO_PROFILE: ProviderProfileInfo = {
  businessName: 'Amman Clean Pros',
  aboutEn: 'Trusted home cleaning with verified staff.',
  aboutAr: 'تنظيف منازل موثوق بطاقم موثّق.',
  services: [
    { id: 's1', title: 'Standard visit', priceFrom: 15 },
    { id: 's2', title: 'Deep cleaning', priceFrom: 35 },
  ],
  verified: true,
  trustScore: 0.88,
  documents: [
    { id: 'd1', label: 'Trade license', status: 'approved' },
    { id: 'd2', label: 'ID', status: 'approved' },
  ],
  galleryCount: 8,
};

/** Provider-safe AI only — no confidential marketplace internals. */
export const DEMO_AI_INSIGHTS: ProviderAiInsight[] = [
  {
    code: 'forecast_weekend',
    kind: 'forecast',
    labelEn: 'Demand rises this weekend in your corridor.',
    labelAr: 'الطلب يرتفع نهاية الأسبوع في ممرك.',
  },
  {
    code: 'pricing_fair',
    kind: 'pricing',
    labelEn: 'Suggested range for standard visits: 15–22 JOD.',
    labelAr: 'النطاق المقترح للزيارات العادية: 15–22 دينار.',
  },
  {
    code: 'schedule_gap',
    kind: 'scheduling',
    labelEn: 'Idle gap mid-afternoon — consider a short slot.',
    labelAr: 'فجوة ظهراً — فكّر في فترة قصيرة.',
  },
  {
    code: 'match_evening',
    kind: 'matching',
    labelEn: 'You rank well for evening nearby jobs.',
    labelAr: 'ترتيبك قوي لأعمال المساء القريبة.',
  },
  {
    code: 'opp_nearby',
    kind: 'opportunity',
    labelEn: 'Nearby underserved pocket — expand carefully.',
    labelAr: 'جيوب قريبة ناقصة الخدمة — توسّع بحذر.',
  },
];
