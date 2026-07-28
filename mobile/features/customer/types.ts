/** Customer domain types — Sprint 9 Phase 2 */

export type LocalizedName = { en: string; ar: string };

export type CustomerCategory = {
  id: string;
  slug: string;
  name: LocalizedName;
  icon: string;
  featured: boolean;
  popular: boolean;
  parentId: string | null;
  imageUrl?: string | null;
};

export type CustomerProvider = {
  id: string;
  name: string;
  photoUrl: string | null;
  verified: boolean;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  startingPrice: number;
  currency: string;
  available: boolean;
  responseTimeMin: number | null;
  aiMatchScore: number | null;
  categoryIds: string[];
  city: string;
  about: LocalizedName;
  trustScore: number;
};

export type ProviderService = {
  id: string;
  title: LocalizedName;
  priceFrom: number;
  durationMin: number;
};

export type ProviderReview = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
};

export type ProviderProfile = CustomerProvider & {
  gallery: string[];
  services: ProviderService[];
  reviews: ProviderReview[];
  highlights: string[];
  lat: number | null;
  lng: number | null;
};

export type BookingStatus =
  | 'upcoming'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type CustomerBooking = {
  id: string;
  providerId: string;
  providerName: string;
  serviceTitle: string;
  status: BookingStatus;
  scheduledAt: string;
  address: string;
  priceEstimate: number;
  currency: string;
  notes: string | null;
  canReschedule: boolean;
};

export type BookingDraft = {
  providerId: string;
  serviceId: string | null;
  date: string | null;
  time: string | null;
  address: string;
  notes: string;
  imageUris: string[];
  priceEstimate: number | null;
  aiPriceHint: number | null;
};

export type CustomerNotification = {
  id: string;
  kind: 'booking' | 'message' | 'recommendation' | 'promotion' | 'system';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type CustomerAiInsight = {
  code: string;
  labelEn: string;
  labelAr: string;
  kind: 'match' | 'price' | 'availability' | 'recommendation' | 'forecast';
};

export type HomeFeed = {
  locationLabel: string;
  categories: CustomerCategory[];
  recommended: CustomerProvider[];
  recentlyViewed: CustomerProvider[];
  trending: CustomerProvider[];
  nearby: CustomerProvider[];
  aiRecommendations: CustomerAiInsight[];
  banners: { id: string; title: string; subtitle: string }[];
  quickActions: { id: string; label: string; href: string }[];
};
