import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";

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
  provider_id: string;
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
};

export type ProviderRequestSettings = {
  provider_id: string;
  accepting_requests: boolean;
  max_pending_requests: number;
  auto_reject_message: string | null;
  vacation_mode: boolean;
  estimated_response_hours: number;
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
