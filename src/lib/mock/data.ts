import type { Locale } from "@/lib/i18n/config";
import type { MockProvider, MockReview, SearchFilters, SortOption } from "@/types/domain.types";

export const MOCK_CITIES: { id: string; label: Record<Locale, string> }[] = [
  { id: "damascus", label: { ar: "دمشق", en: "Damascus" } },
  { id: "aleppo", label: { ar: "حلب", en: "Aleppo" } },
  { id: "homs", label: { ar: "حمص", en: "Homs" } },
  { id: "latakia", label: { ar: "اللاذقية", en: "Latakia" } },
];

export const MOCK_PROVIDERS: MockProvider[] = [
  {
    id: "1",
    slug: "ahmad-plumbing",
    name: { ar: "أحمد للسباكة", en: "Ahmad Plumbing" },
    category: "plumber",
    city: { ar: "دمشق", en: "Damascus" },
    district: { ar: "المزة", en: "Al-Mazzeh" },
    rating: 4.9,
    reviewCount: 128,
    trustScore: 96,
    verified: true,
    distanceKm: 1.2,
    coverImage:
      "https://images.unsplash.com/photo-1585704032915-e24159fc8b8d?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    about: {
      ar: "سبّاك محترف مع أكثر من 15 عاماً من الخبرة في دمشق. إصلاح التسريبات، تركيب الأنابيب، وصيانة دورية.",
      en: "Professional plumber with 15+ years of experience in Damascus. Leak repairs, pipe installation, and routine maintenance.",
    },
    services: [
      { ar: "إصلاح التسريبات", en: "Leak repairs" },
      { ar: "تركيب أنابيب", en: "Pipe installation" },
      { ar: "صيانة دورية", en: "Routine maintenance" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1581094794329-cd2b2a5b3f6e?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&h=400&fit=crop",
    ],
    phone: "+963944123456",
    whatsapp: "+963944123456",
    featured: true,
    responseTimeHours: 2,
  },
  {
    id: "2",
    slug: "syria-electric",
    name: { ar: "كهرباء سوريا", en: "Syria Electric" },
    category: "electrician",
    city: { ar: "دمشق", en: "Damascus" },
    district: { ar: "كفرسوسة", en: "Kafr Sousa" },
    rating: 4.7,
    reviewCount: 89,
    trustScore: 91,
    verified: true,
    distanceKm: 2.8,
    coverImage:
      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    about: {
      ar: "فريق كهربائي معتمد لجميع أعمال الكهرباء المنزلية والتجارية في العاصمة.",
      en: "Certified electrical team for all residential and commercial work in the capital.",
    },
    services: [
      { ar: "تمديدات كهربائية", en: "Electrical wiring" },
      { ar: "إصلاح الأعطال", en: "Fault repair" },
      { ar: "تركيب إنارة", en: "Lighting installation" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&h=400&fit=crop",
    ],
    phone: "+963933987654",
    whatsapp: "+963933987654",
    featured: true,
    responseTimeHours: 3,
  },
  {
    id: "3",
    slug: "dr-sara-clinic",
    name: { ar: "عيادة د. سارة", en: "Dr. Sara Clinic" },
    category: "doctor",
    city: { ar: "حلب", en: "Aleppo" },
    district: { ar: "العزيزية", en: "Al-Aziziyah" },
    rating: 4.8,
    reviewCount: 204,
    trustScore: 94,
    verified: true,
    distanceKm: 5.1,
    coverImage:
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop",
    about: {
      ar: "طبيبة عامة متخصصة في الرعاية الأولية والفحوصات الدورية للعائلات.",
      en: "General practitioner specializing in primary care and routine family checkups.",
    },
    services: [
      { ar: "فحص عام", en: "General checkup" },
      { ar: "استشارة طبية", en: "Medical consultation" },
      { ar: "متابعة مزمنة", en: "Chronic follow-up" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1631217868264-e5b9bb5617d7?w=600&h=400&fit=crop",
    ],
    phone: "+963112345678",
    whatsapp: "+963112345678",
    featured: true,
    responseTimeHours: 4,
  },
  {
    id: "4",
    slug: "law-office-omar",
    name: { ar: "مكتب المحامي عمر", en: "Omar Law Office" },
    category: "lawyer",
    city: { ar: "دمشق", en: "Damascus" },
    district: { ar: "المالكي", en: "Al-Maliki" },
    rating: 4.6,
    reviewCount: 56,
    trustScore: 88,
    verified: true,
    distanceKm: 3.4,
    coverImage:
      "https://images.unsplash.com/photo-1589829545855-d10d557cf95f?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop",
    about: {
      ar: "استشارات قانونية في القضايا المدنية والتجارية وصياغة العقود.",
      en: "Legal counsel for civil and commercial cases and contract drafting.",
    },
    services: [
      { ar: "استشارة قانونية", en: "Legal consultation" },
      { ar: "صياغة عقود", en: "Contract drafting" },
      { ar: "تمثيل قضائي", en: "Court representation" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=400&fit=crop",
    ],
    phone: "+963955111222",
    whatsapp: "+963955111222",
    featured: false,
    responseTimeHours: 6,
  },
  {
    id: "5",
    slug: "auto-fix-homs",
    name: { ar: "أوتو فكس حمص", en: "Auto Fix Homs" },
    category: "mechanic",
    city: { ar: "حمص", en: "Homs" },
    district: { ar: "الوعر", en: "Al-Waer" },
    rating: 4.5,
    reviewCount: 73,
    trustScore: 85,
    verified: false,
    distanceKm: 8.2,
    coverImage:
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    about: {
      ar: "ورشة ميكانيك سيارات شاملة — صيانة، كهرباء سيارات، وتبديل زيوت.",
      en: "Full-service auto workshop — maintenance, auto electrical, and oil changes.",
    },
    services: [
      { ar: "صيانة دورية", en: "Routine maintenance" },
      { ar: "فحص كمبيوتر", en: "Computer diagnostics" },
      { ar: "تبديل زيت", en: "Oil change" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600&h=400&fit=crop",
    ],
    phone: "+963991234567",
    whatsapp: "+963991234567",
    featured: false,
    responseTimeHours: 5,
  },
  {
    id: "6",
    slug: "clean-home-latakia",
    name: { ar: "كلين هوم اللاذقية", en: "Clean Home Latakia" },
    category: "cleaner",
    city: { ar: "اللاذقية", en: "Latakia" },
    district: { ar: "الرمل الجنوبي", en: "South Al-Raml" },
    rating: 4.8,
    reviewCount: 142,
    trustScore: 92,
    verified: true,
    distanceKm: 4.6,
    coverImage:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    about: {
      ar: "خدمات تنظيف منزلية ومكتبية احترافية مع فريق مدرب ومواد آمنة.",
      en: "Professional home and office cleaning with a trained team and safe supplies.",
    },
    services: [
      { ar: "تنظيف منازل", en: "Home cleaning" },
      { ar: "تنظيف مكاتب", en: "Office cleaning" },
      { ar: "تنظيف عميق", en: "Deep cleaning" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1563453392212-326f5e8541b2?w=600&h=400&fit=crop",
    ],
    phone: "+963944555666",
    whatsapp: "+963944555666",
    featured: true,
    responseTimeHours: 2,
  },
  {
    id: "7",
    slug: "quick-plumber-aleppo",
    name: { ar: "سباكة سريعة حلب", en: "Quick Plumber Aleppo" },
    category: "plumber",
    city: { ar: "حلب", en: "Aleppo" },
    district: { ar: "الجميلية", en: "Al-Jamiliyah" },
    rating: 4.4,
    reviewCount: 45,
    trustScore: 82,
    verified: false,
    distanceKm: 6.7,
    coverImage:
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
    about: {
      ar: "خدمات سباكة طارئة على مدار الساعة في حلب.",
      en: "24/7 emergency plumbing services across Aleppo.",
    },
    services: [
      { ar: "طوارئ 24/7", en: "24/7 emergency" },
      { ar: "إصلاح سخانات", en: "Water heater repair" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1581094794329-cd2b2a5b3f6e?w=600&h=400&fit=crop",
    ],
    phone: "+963933444555",
    whatsapp: "+963933444555",
    featured: false,
    responseTimeHours: 1,
  },
  {
    id: "8",
    slug: "elite-electric-aleppo",
    name: { ar: "الكهرباء المتميزة", en: "Elite Electric" },
    category: "electrician",
    city: { ar: "حلب", en: "Aleppo" },
    district: { ar: "الفرقان", en: "Al-Furqan" },
    rating: 4.9,
    reviewCount: 97,
    trustScore: 95,
    verified: true,
    distanceKm: 7.3,
    coverImage:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=400&fit=crop",
    avatarImage:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop",
    about: {
      ar: "متخصصون في الأنظمة الكهربائية الحديثة والطاقة الشمسية.",
      en: "Specialists in modern electrical systems and solar installations.",
    },
    services: [
      { ar: "طاقة شمسية", en: "Solar installation" },
      { ar: "أنظمة ذكية", en: "Smart home systems" },
    ],
    gallery: [
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop",
    ],
    phone: "+963944777888",
    whatsapp: "+963944777888",
    featured: false,
    responseTimeHours: 4,
  },
];

export const MOCK_REVIEWS: MockReview[] = [
  {
    id: "r1",
    providerId: "1",
    author: { ar: "محمد ك.", en: "Mohammed K." },
    rating: 5,
    comment: {
      ar: "خدمة ممتازة ووصل بسرعة. أصلح التسريب في أقل من ساعة.",
      en: "Excellent service, arrived quickly. Fixed the leak in under an hour.",
    },
    date: "2026-03-01",
  },
  {
    id: "r2",
    providerId: "1",
    author: { ar: "ليلى س.", en: "Layla S." },
    rating: 5,
    comment: {
      ar: "محترف ونظيف في العمل. أنصح به بشدة.",
      en: "Professional and tidy work. Highly recommended.",
    },
    date: "2026-02-15",
  },
  {
    id: "r3",
    providerId: "2",
    author: { ar: "خالد م.", en: "Khaled M." },
    rating: 4,
    comment: {
      ar: "عمل جيد لكن تأخر قليلاً عن الموعد.",
      en: "Good work but arrived slightly late.",
    },
    date: "2026-02-28",
  },
  {
    id: "r4",
    providerId: "3",
    author: { ar: "نور أ.", en: "Nour A." },
    rating: 5,
    comment: {
      ar: "دكتورة متمكنة ولبقة. العيادة منظمة جداً.",
      en: "Skilled and kind doctor. Very organized clinic.",
    },
    date: "2026-03-05",
  },
];

export const MOCK_BUSINESS_STATS = {
  profileViews: 1247,
  profileViewsChange: 12.4,
  searchAppearances: 3891,
  searchAppearancesChange: 8.2,
  contactClicks: 186,
  contactClicksChange: 15.7,
  favorites: 94,
  favoritesChange: 5.3,
};

export const MOCK_BUSINESS_PROFILE = MOCK_PROVIDERS[0];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(provider: MockProvider, query: string, locale: Locale): boolean {
  const q = normalize(query);
  if (!q) return true;

  const haystack = [
    provider.name[locale],
    provider.name.ar,
    provider.name.en,
    provider.city[locale],
    provider.district[locale],
    provider.category,
    ...provider.services.map((s) => s[locale]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function sortProviders(providers: MockProvider[], sort: SortOption): MockProvider[] {
  const sorted = [...providers];

  switch (sort) {
    case "highest_rated":
      return sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case "nearest":
      return sorted.sort((a, b) => a.distanceKm - b.distanceKm);
    case "verified":
      return sorted.sort(
        (a, b) => Number(b.verified) - Number(a.verified) || b.trustScore - a.trustScore,
      );
    case "best_match":
    default:
      return sorted.sort((a, b) => b.trustScore - a.trustScore || b.rating - a.rating);
  }
}

export function searchProviders(filters: SearchFilters, locale: Locale): MockProvider[] {
  const sort = filters.sort ?? "best_match";

  const results = MOCK_PROVIDERS.filter((provider) => {
    if (filters.category && provider.category !== filters.category) return false;
    if (filters.verifiedOnly && !provider.verified) return false;
    if (filters.minRating && provider.rating < filters.minRating) return false;
    if (filters.city) {
      const city = MOCK_CITIES.find((c) => c.id === filters.city);
      if (city && normalize(provider.city.en) !== normalize(city.label.en)) return false;
    }
    if (filters.query && !matchesQuery(provider, filters.query, locale)) return false;
    return true;
  });

  return sortProviders(results, sort);
}

export function getProviderById(id: string): MockProvider | undefined {
  return MOCK_PROVIDERS.find((p) => p.id === id || p.slug === id);
}

export function getFeaturedProviders(): MockProvider[] {
  return MOCK_PROVIDERS.filter((p) => p.featured);
}

export function getReviewsForProvider(providerId: string): MockReview[] {
  return MOCK_REVIEWS.filter((r) => r.providerId === providerId);
}

export async function simulateLoading<T>(data: T, ms = 400): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return data;
}
