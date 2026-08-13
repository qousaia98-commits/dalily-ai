/**
 * Customer data services — Supabase when available, demo fallback otherwise.
 * Never expose internal marketplace metrics.
 */

import { supabase } from '@/lib/supabase';
import {
  DEMO_BOOKINGS,
  DEMO_CATEGORIES,
  DEMO_NOTIFICATIONS,
  DEMO_PROVIDERS,
  demoHomeFeed,
  demoProviderProfile,
} from '@/features/customer/demo-data';
import type {
  CustomerAiInsight,
  CustomerBooking,
  CustomerCategory,
  CustomerNotification,
  CustomerProvider,
  HomeFeed,
  ProviderProfile,
} from '@/features/customer/types';
import { env } from '@/constants/env';
import { useSearchStore } from '@/store/customer';
import {
  getLocalBooking,
  listLocalBookings,
  rememberLocalBooking,
} from '@/features/customer/local-bookings';

function hasBackend(): boolean {
  return Boolean(env.supabaseUrl && !env.supabaseUrl.includes('placeholder'));
}

function localizeName(raw: unknown, fallback: string): { en: string; ar: string } {
  if (raw && typeof raw === 'object') {
    const o = raw as { en?: string; ar?: string };
    return { en: o.en ?? fallback, ar: o.ar ?? o.en ?? fallback };
  }
  if (typeof raw === 'string') return { en: raw, ar: raw };
  return { en: fallback, ar: fallback };
}

export async function fetchHomeFeed(): Promise<HomeFeed> {
  const feed = demoHomeFeed();
  const recentIds = useSearchStore.getState().recentProviderIds;
  if (recentIds.length) {
    feed.recentlyViewed = recentIds
      .map((id) => DEMO_PROVIDERS.find((p) => p.id === id))
      .filter((p): p is CustomerProvider => Boolean(p));
  }

  if (!hasBackend()) return feed;

  try {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, slug, name')
      .limit(20);
    if (cats?.length) {
      feed.categories = cats.map((c) => ({
        id: String(c.id),
        slug: String(c.slug ?? c.id),
        name: localizeName(c.name, String(c.slug ?? 'Category')),
        icon: '🏷️',
        featured: true,
        popular: true,
        parentId: null,
      }));
    }

    const { data: providers } = await supabase
      .from('providers')
      .select('id, name, rating_avg, review_count, verification_status')
      .eq('status', 'active')
      .limit(20);
    if (providers?.length) {
      const mapped: CustomerProvider[] = providers.map((p, i) => {
        const nameObj = localizeName(p.name, 'Provider');
        return {
          id: String(p.id),
          name: nameObj.en,
          photoUrl: null,
          verified: String(p.verification_status ?? '') === 'verified',
          rating: Number(p.rating_avg ?? 0),
          reviewCount: Number(p.review_count ?? 0),
          distanceKm: null,
          startingPrice: 15 + i * 2,
          currency: 'USD',
          available: true,
          responseTimeMin: 10 + i * 3,
          aiMatchScore: Math.max(0.55, 0.95 - i * 0.04),
          categoryIds: [],
          city: '',
          about: nameObj,
          trustScore: Math.min(1, Number(p.rating_avg ?? 0) / 5),
        };
      });
      feed.recommended = mapped.slice(0, 6);
      feed.trending = [...mapped].sort((a, b) => b.reviewCount - a.reviewCount);
      feed.nearby = mapped;
    }
  } catch {
    /* keep demo */
  }

  return feed;
}

export async function fetchCategories(): Promise<CustomerCategory[]> {
  if (!hasBackend()) return DEMO_CATEGORIES;
  try {
    const { data } = await supabase.from('categories').select('id, slug, name').limit(50);
    if (!data?.length) return DEMO_CATEGORIES;
    return data.map((c) => ({
      id: String(c.id),
      slug: String(c.slug ?? c.id),
      name: localizeName(c.name, 'Category'),
      icon: '🏷️',
      featured: false,
      popular: true,
      parentId: null,
    }));
  } catch {
    return DEMO_CATEGORIES;
  }
}

export async function searchProviders(input: {
  query?: string;
  categoryId?: string;
}): Promise<CustomerProvider[]> {
  const q = (input.query ?? '').trim().toLowerCase();

  // Real backend: query whenever available, not only once the user has
  // typed something — an empty query should show real nearby/active
  // providers, not silently fall back to demo data.
  if (hasBackend()) {
    try {
      const { data } = await supabase
        .from('providers')
        .select('id, name, rating_avg, review_count, verification_status')
        .eq('status', 'active')
        .limit(30);
      if (data?.length) {
        const mapped = data.map((p, i) => {
          const nameObj = localizeName(p.name, 'Provider');
          return {
            id: String(p.id),
            name: nameObj.en,
            photoUrl: null,
            verified: String(p.verification_status ?? '') === 'verified',
            rating: Number(p.rating_avg ?? 0),
            reviewCount: Number(p.review_count ?? 0),
            distanceKm: null,
            startingPrice: 15,
            currency: 'USD',
            available: true,
            responseTimeMin: 15,
            aiMatchScore: 0.8,
            categoryIds: [],
            city: '',
            about: nameObj,
            trustScore: Math.min(1, Number(p.rating_avg ?? 0) / 5),
          } satisfies CustomerProvider;
        });
        return q ? mapped.filter((p) => p.name.toLowerCase().includes(q)) : mapped;
      }
      // Backend reachable but genuinely no active providers yet — real
      // empty state, not a reason to show fake ones.
      if (data) return [];
    } catch {
      /* fall through to demo below */
    }
  }

  let list = [...DEMO_PROVIDERS];
  if (input.categoryId) {
    list = list.filter((p) => p.categoryIds.includes(input.categoryId!));
  }
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.about.en.toLowerCase().includes(q),
    );
  }
  return list;
}

export async function fetchProviderProfile(id: string): Promise<ProviderProfile | null> {
  const demo = demoProviderProfile(id);
  if (demo) return demo;
  if (!hasBackend()) return null;
  try {
    const { data } = await supabase
      .from('providers')
      .select('id, name, rating_avg, review_count, verification_status')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    const nameObj = localizeName(data.name, 'Provider');
    return {
      id: String(data.id),
      name: nameObj.en,
      photoUrl: null,
      verified: String(data.verification_status ?? '') === 'verified',
      rating: Number(data.rating_avg ?? 0),
      reviewCount: Number(data.review_count ?? 0),
      distanceKm: null,
      startingPrice: 20,
      currency: 'JOD',
      available: true,
      responseTimeMin: 20,
      aiMatchScore: null,
      categoryIds: [],
      city: 'Amman',
      about: nameObj,
      trustScore: Math.min(1, Number(data.rating_avg ?? 0) / 5),
      gallery: [],
      services: [
        {
          id: 'svc-default',
          title: { en: 'Service visit', ar: 'زيارة خدمة' },
          priceFrom: 20,
          durationMin: 60,
        },
      ],
      reviews: [],
      highlights: [],
      lat: null,
      lng: null,
    };
  } catch {
    return null;
  }
}

export async function fetchBookings(): Promise<CustomerBooking[]> {
  const local = listLocalBookings();
  if (!hasBackend()) return [...local, ...DEMO_BOOKINGS];
  try {
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) return [...local, ...DEMO_BOOKINGS];
    const { data } = await supabase
      .from('bookings')
      .select('id, status, starts_at, location_text, provider_id, service_id, customer_notes')
      .eq('customer_id', session.user.id)
      .order('starts_at', { ascending: false })
      .limit(40);
    if (!data?.length) return [...local, ...DEMO_BOOKINGS];

    const providerIds = [...new Set(data.map((b) => String(b.provider_id)))];
    const serviceIds = [...new Set(data.map((b) => b.service_id).filter((id): id is string => Boolean(id)))];
    const [{ data: providers }, { data: services }] = await Promise.all([
      providerIds.length
        ? supabase.from('providers').select('id, name').in('id', providerIds)
        : Promise.resolve({ data: [] as { id: string; name: unknown }[] }),
      serviceIds.length
        ? supabase.from('provider_services').select('id, name').in('id', serviceIds)
        : Promise.resolve({ data: [] as { id: string; name: unknown }[] }),
    ]);
    const providerNames = new Map(
      (providers ?? []).map((p) => [String(p.id), localizeName(p.name, 'Provider').en]),
    );
    const serviceTitles = new Map(
      (services ?? []).map((s) => [String(s.id), localizeName(s.name, 'Service').en]),
    );

    const remote = data.map((b) => {
      const statusRaw = String(b.status);
      let status: CustomerBooking['status'] = 'upcoming';
      if (statusRaw.includes('cancel')) status = 'cancelled';
      else if (['completed', 'customer_confirmed'].includes(statusRaw)) status = 'completed';
      else if (['in_progress', 'provider_en_route', 'arrived'].includes(statusRaw)) {
        status = 'in_progress';
      }
      return {
        id: String(b.id),
        providerId: String(b.provider_id),
        providerName: providerNames.get(String(b.provider_id)) ?? 'Provider',
        serviceTitle: b.service_id ? (serviceTitles.get(String(b.service_id)) ?? 'Service') : 'Service',
        status,
        scheduledAt: String(b.starts_at),
        address: String(b.location_text ?? ''),
        priceEstimate: 0,
        currency: 'USD',
        notes: b.customer_notes ? String(b.customer_notes) : null,
        canReschedule: status === 'upcoming',
      };
    });
    return [...local, ...remote];
  } catch {
    return [...local, ...DEMO_BOOKINGS];
  }
}

export async function fetchBooking(id: string): Promise<CustomerBooking | null> {
  const local = getLocalBooking(id);
  if (local) return local;
  const all = await fetchBookings();
  return all.find((b) => b.id === id) ?? null;
}

export async function submitBookingDraft(input: {
  providerId: string;
  serviceTitle: string;
  scheduledAt: string;
  address: string;
  notes: string;
  priceEstimate: number;
}): Promise<CustomerBooking> {
  const booking: CustomerBooking = {
    id: `bk-local-${Date.now()}`,
    providerId: input.providerId,
    providerName:
      DEMO_PROVIDERS.find((p) => p.id === input.providerId)?.name ?? 'Provider',
    serviceTitle: input.serviceTitle,
    status: 'upcoming',
    scheduledAt: input.scheduledAt,
    address: input.address,
    priceEstimate: input.priceEstimate,
    currency: 'JOD',
    notes: input.notes || null,
    canReschedule: true,
  };
  rememberLocalBooking(booking);
  return booking;
}

export async function fetchNotifications(): Promise<CustomerNotification[]> {
  return DEMO_NOTIFICATIONS;
}

/** Customer-safe AI only — no internal marketplace metrics. */
export async function fetchCustomerAiInsights(context?: {
  categorySlug?: string;
}): Promise<CustomerAiInsight[]> {
  const insights: CustomerAiInsight[] = [
    {
      code: 'availability_window',
      labelEn: 'Recommended booking window: today 10:00–14:00.',
      labelAr: 'نافذة الحجز الموصى بها: اليوم 10:00–14:00.',
      kind: 'availability',
    },
    {
      code: 'fair_price',
      labelEn: 'Fair price expected for nearby verified pros.',
      labelAr: 'سعر عادل متوقع للمزوّدين الموثّقين القريبين.',
      kind: 'price',
    },
    {
      code: 'match_hint',
      labelEn: 'Providers with strong response times match your needs.',
      labelAr: 'المزوّدون سريعو الاستجابة يناسبون احتياجك.',
      kind: 'match',
    },
  ];
  if (context?.categorySlug === 'cleaning') {
    insights.unshift({
      code: 'forecast_soft',
      labelEn: 'Cleaning demand rises this weekend — book early.',
      labelAr: 'طلب التنظيف يرتفع نهاية الأسبوع — احجز مبكراً.',
      kind: 'forecast',
    });
  }
  return insights;
}

export function getSearchSuggestions(query: string): string[] {
  const base = [
    'cleaning',
    'plumbing',
    'AC repair',
    'gardening',
    'moving help',
    'electrical',
    'deep cleaning',
  ];
  const q = query.trim().toLowerCase();
  if (!q) return base.slice(0, 5);
  return base.filter((s) => s.includes(q)).slice(0, 6);
}
