import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import type { MarketplaceRequestMeta } from "@/domains/marketplace/types";

export type QuoteRow = {
  id: string;
  service_request_id: string;
  provider_id: string;
  price: number;
  currency: string;
  estimated_duration_text: string | null;
  notes: string | null;
  status: "sent" | "accepted" | "declined" | "changes_requested" | "superseded";
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

export type ServiceReviewRow = {
  id: string;
  service_request_id: string;
  provider_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  recommend: boolean | null;
  created_at: string;
};

export type ServiceRequestRow = {
  id: string;
  customer_id: string;
  /** Null for marketplace-native intent requests (lifecycle_version >= 2) until matching. */
  provider_id: string | null;
  title: string;
  description: string;
  preferred_date: string | null;
  preferred_time: string | null;
  budget: number | null;
  location_text: string | null;
  status: ServiceRequestStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  quoted_at: string | null;
  quote_accepted_at: string | null;
  quote_declined_at: string | null;
  in_progress_at: string | null;
  completed_by_business_at: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  reviewed_at: string | null;
  disputed_at: string | null;
  dispute_note: string | null;
  response_time_seconds: number | null;
  completion_time_seconds: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
  /** Sprint 1 additive — present when DB migration applied; default treated as 1. */
  lifecycle_version?: number;
  /** Sprint 1 additive — selection placeholder FK (null until Sprint 4/5). */
  selection_id?: string | null;
  /** Sprint 2 additive */
  category_id?: string | null;
  urgency?: "emergency" | "normal" | null;
  city_id?: string | null;
  intent_text?: string | null;
  category_confirmed?: boolean;
  published_at?: string | null;
};

export type ServiceRequestDetail = ServiceRequestRow & {
  customerName: string;
  providerName: string;
  imagePaths: string[];
  /** Signed URLs for private request photos (short-lived). */
  imageUrls: string[];
  quote: QuoteRow | null;
  review: ServiceReviewRow | null;
  conversationId: string | null;
  /**
   * Present only when MARKETPLACE_DOMAIN_V2=true.
   * Flag off: omitted — identical legacy shape.
   */
  marketplace?: MarketplaceRequestMeta;
};

export type ProviderRequestSettings = {
  provider_id: string;
  accepting_requests: boolean;
  max_pending_requests: number;
  auto_reject_message: string | null;
  vacation_mode: boolean;
  estimated_response_hours: number;
  /** Sprint 8 — emergency matching honesty (default true). */
  handles_emergency: boolean;
};

export type MarketplaceNotification = {
  id: string;
  user_id: string;
  type: string;
  title_key: string;
  body_key: string;
  body_params: Record<string, string | number>;
  href: string | null;
  service_request_id: string | null;
  conversation_id: string | null;
  read_at: string | null;
  created_at: string;
};
