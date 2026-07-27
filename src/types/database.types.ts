export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserStatus = "active" | "suspended" | "banned";
export type AppRole = "user" | "business" | "admin" | "moderator";
export type ProviderStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "active"
  | "suspended"
  | "archived";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "partially_verified"
  | "verified"
  | "rejected"
  | "expired";

export type LocalizedJson = { ar: string; en: string };
export type ImageKind = "avatar" | "cover" | "gallery";
export type ProblemPriority = "emergency" | "high" | "normal" | "low";
export type ProviderVerificationStatus = "pending" | "approved" | "rejected";
export type SubscriptionStatus = "trial" | "active" | "pending_payment" | "expired" | "cancelled";
export type PaymentProviderType = "manual" | "shamcash" | "future" | "stripe";
export type PaymentStatus =
  | "pending"
  | "pending_review"
  | "paid"
  | "failed"
  | "cancelled"
  | "rejected";
export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
export type AuditAction =
  | "provider_approved"
  | "provider_rejected"
  | "provider_changes_requested"
  | "provider_activated"
  | "provider_suspended"
  | "provider_archived"
  | "provider_deleted"
  | "user_role_changed"
  | "user_disabled"
  | "user_activated"
  | "payment_approved"
  | "payment_rejected"
  | "refund_approved"
  | "refund_rejected"
  | "dispute_evidence_uploaded"
  | "subscription_extended"
  | "subscription_cancelled"
  | "subscription_plan_changed"
  | "category_created"
  | "category_updated"
  | "category_disabled"
  | "category_enabled";

export type PaymentEventType =
  | "requested"
  | "receipt_uploaded"
  | "approved"
  | "rejected"
  | "cancelled"
  | "failed"
  | "capture_correlated"
  | "webhook_received";

export type ServiceRequestStatus =
  | "pending"
  | "accepted"
  | "quoted"
  | "quote_accepted"
  | "quote_declined"
  | "in_progress"
  | "completed_by_business"
  | "completed"
  | "disputed"
  | "reviewed"
  | "rejected"
  | "cancelled";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "rescheduled"
  | "expired"
  | "awaiting_customer_confirmation"
  | "customer_confirmed"
  | "issue_reported";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          phone_verified_at: string | null;
          email_verified_at: string | null;
          status: UserStatus;
          last_login_at: string | null;
          preferred_locale: string;
          preferred_city_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          phone?: string | null;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          status?: UserStatus;
          last_login_at?: string | null;
          preferred_locale?: string;
          preferred_city_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          status?: UserStatus;
          last_login_at?: string | null;
          preferred_locale?: string;
          preferred_city_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          granted_at: string;
          granted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: AppRole;
          granted_at?: string;
          granted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: AppRole;
          granted_at?: string;
          granted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      providers: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          name: LocalizedJson;
          about: LocalizedJson | null;
          module_id: string;
          category_id: string;
          city_id: string;
          district_id: string | null;
          address_line: Json | null;
          latitude: number | null;
          longitude: number | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          website: string | null;
          cover_image_id: string | null;
          avatar_image_id: string | null;
          status: ProviderStatus;
          verification_status: VerificationStatus;
          trust_score: number;
          rating_avg: number;
          review_count: number;
          response_time_hours: number | null;
          profile_completeness: number;
          is_featured: boolean;
          featured_until: string | null;
          metadata: Json;
          admin_review_note: string | null;
          changes_requested_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          slug: string;
          name: LocalizedJson;
          about?: LocalizedJson | null;
          module_id: string;
          category_id: string;
          city_id: string;
          district_id?: string | null;
          address_line?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          website?: string | null;
          cover_image_id?: string | null;
          avatar_image_id?: string | null;
          status?: ProviderStatus;
          verification_status?: VerificationStatus;
          trust_score?: number;
          rating_avg?: number;
          review_count?: number;
          response_time_hours?: number | null;
          profile_completeness?: number;
          is_featured?: boolean;
          featured_until?: string | null;
          metadata?: Json;
          admin_review_note?: string | null;
          changes_requested_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          slug?: string;
          name?: LocalizedJson;
          about?: LocalizedJson | null;
          module_id?: string;
          category_id?: string;
          city_id?: string;
          district_id?: string | null;
          address_line?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          website?: string | null;
          cover_image_id?: string | null;
          avatar_image_id?: string | null;
          status?: ProviderStatus;
          verification_status?: VerificationStatus;
          trust_score?: number;
          rating_avg?: number;
          review_count?: number;
          response_time_hours?: number | null;
          profile_completeness?: number;
          is_featured?: boolean;
          featured_until?: string | null;
          metadata?: Json;
          admin_review_note?: string | null;
          changes_requested_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      images: {
        Row: {
          id: string;
          owner_id: string;
          provider_id: string;
          bucket: string;
          path: string;
          kind: ImageKind;
          alt_text: LocalizedJson | null;
          sort_order: number;
          is_featured: boolean;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          provider_id: string;
          bucket?: string;
          path: string;
          kind: ImageKind;
          alt_text?: LocalizedJson | null;
          sort_order?: number;
          is_featured?: boolean;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          provider_id?: string;
          bucket?: string;
          path?: string;
          kind?: ImageKind;
          alt_text?: LocalizedJson | null;
          sort_order?: number;
          is_featured?: boolean;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      provider_services: {
        Row: {
          id: string;
          provider_id: string;
          name: LocalizedJson;
          description: LocalizedJson | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          provider_id: string;
          name: LocalizedJson;
          description?: LocalizedJson | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          provider_id?: string;
          name?: LocalizedJson;
          description?: LocalizedJson | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      provider_working_hours: {
        Row: {
          id: string;
          provider_id: string;
          day_of_week: number;
          opens_at: string | null;
          closes_at: string | null;
          is_closed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          day_of_week: number;
          opens_at?: string | null;
          closes_at?: string | null;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          day_of_week?: number;
          opens_at?: string | null;
          closes_at?: string | null;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          id: string;
          slug: string;
          name: LocalizedJson;
          country_code: string;
          latitude: number | null;
          longitude: number | null;
          population: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: LocalizedJson;
          country_code?: string;
          latitude?: number | null;
          longitude?: number | null;
          population?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: LocalizedJson;
          country_code?: string;
          latitude?: number | null;
          longitude?: number | null;
          population?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          module_id: string;
          parent_id: string | null;
          slug: string;
          name: LocalizedJson;
          description: LocalizedJson | null;
          icon: string | null;
          depth: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          module_id: string;
          parent_id?: string | null;
          slug: string;
          name: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          depth?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          module_id?: string;
          parent_id?: string | null;
          slug?: string;
          name?: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          depth?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      provider_verifications: {
        Row: {
          id: string;
          provider_id: string;
          id_front_url: string | null;
          id_back_url: string | null;
          selfie_url: string | null;
          status: ProviderVerificationStatus;
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          id_front_url?: string | null;
          id_back_url?: string | null;
          selfie_url?: string | null;
          status?: ProviderVerificationStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          id_front_url?: string | null;
          id_back_url?: string | null;
          selfie_url?: string | null;
          status?: ProviderVerificationStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          slug: string;
          name: LocalizedJson;
          monthly_price_usd: number;
          yearly_price_usd: number;
          features: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: LocalizedJson;
          monthly_price_usd?: number;
          yearly_price_usd?: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: LocalizedJson;
          monthly_price_usd?: number;
          yearly_price_usd?: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          provider_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          starts_at: string;
          expires_at: string | null;
          auto_renew: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          starts_at?: string;
          expires_at?: string | null;
          auto_renew?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          starts_at?: string;
          expires_at?: string | null;
          auto_renew?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          provider_id: string;
          subscription_id: string | null;
          payment_provider: PaymentProviderType;
          payment_status: PaymentStatus;
          amount: number;
          currency: string;
          payment_reference: string;
          receipt_path: string | null;
          receipt_mime_type: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          rejected_at: string | null;
          rejected_by: string | null;
          admin_note: string | null;
          external_transaction_id: string | null;
          paid_at: string | null;
          created_at: string;
          purpose: string;
          unlock_session_id: string | null;
          idempotency_key: string | null;
        };
        Insert: {
          id?: string;
          provider_id: string;
          subscription_id?: string | null;
          payment_provider?: PaymentProviderType;
          payment_status?: PaymentStatus;
          amount: number;
          currency?: string;
          payment_reference: string;
          receipt_path?: string | null;
          receipt_mime_type?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          admin_note?: string | null;
          external_transaction_id?: string | null;
          paid_at?: string | null;
          created_at?: string;
          purpose?: string;
          unlock_session_id?: string | null;
          idempotency_key?: string | null;
        };
        Update: {
          id?: string;
          provider_id?: string;
          subscription_id?: string | null;
          payment_provider?: PaymentProviderType;
          payment_status?: PaymentStatus;
          amount?: number;
          currency?: string;
          payment_reference?: string;
          receipt_path?: string | null;
          receipt_mime_type?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          admin_note?: string | null;
          external_transaction_id?: string | null;
          paid_at?: string | null;
          created_at?: string;
          purpose?: string;
          unlock_session_id?: string | null;
          idempotency_key?: string | null;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          id: string;
          payment_id: string;
          event_type: string;
          actor_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          event_type: string;
          actor_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          event_type?: string;
          actor_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_webhook_events: {
        Row: {
          id: string;
          provider: string;
          external_event_id: string;
          event_type: string;
          payload: Json;
          processing_status: string;
          payment_id: string | null;
          error_message: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          provider?: string;
          external_event_id: string;
          event_type: string;
          payload?: Json;
          processing_status?: string;
          payment_id?: string | null;
          error_message?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          external_event_id?: string;
          event_type?: string;
          payload?: Json;
          processing_status?: string;
          payment_id?: string | null;
          error_message?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          provider_id: string;
          payment_id: string | null;
          invoice_number: string;
          subtotal: number;
          total: number;
          currency: string;
          status: InvoiceStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          payment_id?: string | null;
          invoice_number: string;
          subtotal: number;
          total: number;
          currency?: string;
          status?: InvoiceStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          payment_id?: string | null;
          invoice_number?: string;
          subtotal?: number;
          total?: number;
          currency?: string;
          status?: InvoiceStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action: AuditAction;
          entity_type: string;
          entity_id: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: AuditAction;
          entity_type: string;
          entity_id: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: AuditAction;
          entity_type?: string;
          entity_id?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      search_logs: {
        Row: {
          id: string;
          user_id: string | null;
          query_text: string;
          normalized_query: string | null;
          problem_id: string | null;
          category_slug: string | null;
          city_slug: string | null;
          priority: ProblemPriority | null;
          result_count: number;
          provider_ids: string[];
          nearby_radius: string | null;
          ranking_snapshot: Json;
          locale: string | null;
          input_mode: string | null;
          voice_language: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          query_text: string;
          normalized_query?: string | null;
          problem_id?: string | null;
          category_slug?: string | null;
          city_slug?: string | null;
          priority?: ProblemPriority | null;
          result_count?: number;
          provider_ids?: string[];
          nearby_radius?: string | null;
          ranking_snapshot?: Json;
          locale?: string | null;
          input_mode?: string | null;
          voice_language?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          query_text?: string;
          normalized_query?: string | null;
          problem_id?: string | null;
          category_slug?: string | null;
          city_slug?: string | null;
          priority?: ProblemPriority | null;
          result_count?: number;
          provider_ids?: string[];
          nearby_radius?: string | null;
          ranking_snapshot?: Json;
          locale?: string | null;
          input_mode?: string | null;
          voice_language?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_engagement_events: {
        Row: {
          id: string;
          provider_id: string;
          event_type: string;
          search_log_id: string | null;
          position: number | null;
          metadata: Json;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          event_type: string;
          search_log_id?: string | null;
          position?: number | null;
          metadata?: Json;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          event_type?: string;
          search_log_id?: string | null;
          position?: number | null;
          metadata?: Json;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      learning_events: {
        Row: {
          id: string;
          event_type: string;
          provider_id: string | null;
          customer_id: string | null;
          service_request_id: string | null;
          search_log_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          provider_id?: string | null;
          customer_id?: string | null;
          service_request_id?: string | null;
          search_log_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          provider_id?: string | null;
          customer_id?: string | null;
          service_request_id?: string | null;
          search_log_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_performance_scores: {
        Row: {
          provider_id: string;
          performance_score: number;
          acceptance_rate: number | null;
          completion_rate: number | null;
          avg_rating: number | null;
          avg_response_hours: number | null;
          cancellation_rate: number | null;
          repeat_customer_rate: number | null;
          successful_jobs: number;
          sample_size: number;
          data_quality: number;
          factors: Json;
          computed_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: string;
          performance_score?: number;
          acceptance_rate?: number | null;
          completion_rate?: number | null;
          avg_rating?: number | null;
          avg_response_hours?: number | null;
          cancellation_rate?: number | null;
          repeat_customer_rate?: number | null;
          successful_jobs?: number;
          sample_size?: number;
          data_quality?: number;
          factors?: Json;
          computed_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_id?: string;
          performance_score?: number;
          acceptance_rate?: number | null;
          completion_rate?: number | null;
          avg_rating?: number | null;
          avg_response_hours?: number | null;
          cancellation_rate?: number | null;
          repeat_customer_rate?: number | null;
          successful_jobs?: number;
          sample_size?: number;
          data_quality?: number;
          factors?: Json;
          computed_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_preference_profiles: {
        Row: {
          customer_id: string;
          prefer_nearby: number;
          prefer_premium: number;
          prefer_high_rating: number;
          prefer_fast_response: number;
          sample_size: number;
          factors: Json;
          computed_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          prefer_nearby?: number;
          prefer_premium?: number;
          prefer_high_rating?: number;
          prefer_fast_response?: number;
          sample_size?: number;
          factors?: Json;
          computed_at?: string;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          prefer_nearby?: number;
          prefer_premium?: number;
          prefer_high_rating?: number;
          prefer_fast_response?: number;
          sample_size?: number;
          factors?: Json;
          computed_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_intent_memory: {
        Row: {
          id: string;
          service_request_id: string | null;
          customer_id: string | null;
          original_text: string;
          normalized_text: string;
          language: string | null;
          dialect: string | null;
          detected_category_slug: string | null;
          detected_subcategory: string | null;
          confidence: number | null;
          questions_asked: Json;
          final_category_slug: string | null;
          final_category_id: string | null;
          source: string;
          was_corrected: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_request_id?: string | null;
          customer_id?: string | null;
          original_text: string;
          normalized_text: string;
          language?: string | null;
          dialect?: string | null;
          detected_category_slug?: string | null;
          detected_subcategory?: string | null;
          confidence?: number | null;
          questions_asked?: Json;
          final_category_slug?: string | null;
          final_category_id?: string | null;
          source?: string;
          was_corrected?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string | null;
          customer_id?: string | null;
          original_text?: string;
          normalized_text?: string;
          language?: string | null;
          dialect?: string | null;
          detected_category_slug?: string | null;
          detected_subcategory?: string | null;
          confidence?: number | null;
          questions_asked?: Json;
          final_category_slug?: string | null;
          final_category_id?: string | null;
          source?: string;
          was_corrected?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_knowledge_phrases: {
        Row: {
          id: string;
          phrase: string;
          normalized_phrase: string;
          category_slug: string;
          subcategory: string | null;
          language: string;
          dialect: string | null;
          confidence: number;
          occurrences: number;
          confirmations: number;
          corrections: number;
          success_rate: number;
          last_used_at: string;
          created_at: string;
          updated_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          phrase: string;
          normalized_phrase: string;
          category_slug: string;
          subcategory?: string | null;
          language?: string;
          dialect?: string | null;
          confidence?: number;
          occurrences?: number;
          confirmations?: number;
          corrections?: number;
          success_rate?: number;
          last_used_at?: string;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          phrase?: string;
          normalized_phrase?: string;
          category_slug?: string;
          subcategory?: string | null;
          language?: string;
          dialect?: string | null;
          confidence?: number;
          occurrences?: number;
          confirmations?: number;
          corrections?: number;
          success_rate?: number;
          last_used_at?: string;
          created_at?: string;
          updated_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      ai_intent_decisions: {
        Row: {
          id: string;
          normalized_text: string;
          language: string;
          decision: Json;
          confidence: number;
          hit_count: number;
          last_used_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          normalized_text: string;
          language?: string;
          decision: Json;
          confidence?: number;
          hit_count?: number;
          last_used_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          normalized_text?: string;
          language?: string;
          decision?: Json;
          confidence?: number;
          hit_count?: number;
          last_used_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_dispatch_predictions: {
        Row: {
          id: string;
          service_request_id: string | null;
          provider_id: string | null;
          match_assignment_id: string | null;
          exposure_mode: string;
          response_band: string;
          response_probability: number | null;
          eta_minutes_min: number | null;
          eta_minutes_max: number | null;
          eta_label: string | null;
          predicted_duration_minutes: number | null;
          operational_score: number | null;
          reputation_score: number | null;
          distance_km: number | null;
          capacity_remaining_minutes: number | null;
          route_fit: boolean;
          predicted_rank: number | null;
          metadata: Json;
          created_at: string;
          actual_responded_at: string | null;
          actual_accepted: boolean | null;
          actual_arrived_at: string | null;
          actual_duration_minutes: number | null;
          actual_customer_chose: boolean | null;
          compared_at: string | null;
        };
        Insert: {
          id?: string;
          service_request_id?: string | null;
          provider_id?: string | null;
          match_assignment_id?: string | null;
          exposure_mode?: string;
          response_band?: string;
          response_probability?: number | null;
          eta_minutes_min?: number | null;
          eta_minutes_max?: number | null;
          eta_label?: string | null;
          predicted_duration_minutes?: number | null;
          operational_score?: number | null;
          reputation_score?: number | null;
          distance_km?: number | null;
          capacity_remaining_minutes?: number | null;
          route_fit?: boolean;
          predicted_rank?: number | null;
          metadata?: Json;
          created_at?: string;
          actual_responded_at?: string | null;
          actual_accepted?: boolean | null;
          actual_arrived_at?: string | null;
          actual_duration_minutes?: number | null;
          actual_customer_chose?: boolean | null;
          compared_at?: string | null;
        };
        Update: {
          id?: string;
          service_request_id?: string | null;
          provider_id?: string | null;
          match_assignment_id?: string | null;
          exposure_mode?: string;
          response_band?: string;
          response_probability?: number | null;
          eta_minutes_min?: number | null;
          eta_minutes_max?: number | null;
          eta_label?: string | null;
          predicted_duration_minutes?: number | null;
          operational_score?: number | null;
          reputation_score?: number | null;
          distance_km?: number | null;
          capacity_remaining_minutes?: number | null;
          route_fit?: boolean;
          predicted_rank?: number | null;
          metadata?: Json;
          created_at?: string;
          actual_responded_at?: string | null;
          actual_accepted?: boolean | null;
          actual_arrived_at?: string | null;
          actual_duration_minutes?: number | null;
          actual_customer_chose?: boolean | null;
          compared_at?: string | null;
        };
        Relationships: [];
      };
      ai_provider_reputation: {
        Row: {
          provider_id: string;
          reputation_score: number;
          factors: Json;
          sample_size: number;
          computed_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: string;
          reputation_score?: number;
          factors?: Json;
          sample_size?: number;
          computed_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_id?: string;
          reputation_score?: number;
          factors?: Json;
          sample_size?: number;
          computed_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_service_knowledge: {
        Row: {
          id: string;
          service_key: string;
          category_slug: string;
          subcategory: string | null;
          typical_problems: Json;
          common_causes: Json;
          required_skills: Json;
          typical_tools: Json;
          common_materials: Json;
          duration_min_minutes: number | null;
          duration_typical_minutes: number | null;
          duration_max_minutes: number | null;
          complexity: string;
          emergency_capable: boolean;
          certifications: Json;
          price_min: number | null;
          price_typical: number | null;
          price_max: number | null;
          price_currency: string;
          related_trades: Json;
          match_keywords: Json;
          metadata: Json;
          sample_size: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_key: string;
          category_slug: string;
          subcategory?: string | null;
          typical_problems?: Json;
          common_causes?: Json;
          required_skills?: Json;
          typical_tools?: Json;
          common_materials?: Json;
          duration_min_minutes?: number | null;
          duration_typical_minutes?: number | null;
          duration_max_minutes?: number | null;
          complexity?: string;
          emergency_capable?: boolean;
          certifications?: Json;
          price_min?: number | null;
          price_typical?: number | null;
          price_max?: number | null;
          price_currency?: string;
          related_trades?: Json;
          match_keywords?: Json;
          metadata?: Json;
          sample_size?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_key?: string;
          category_slug?: string;
          subcategory?: string | null;
          typical_problems?: Json;
          common_causes?: Json;
          required_skills?: Json;
          typical_tools?: Json;
          common_materials?: Json;
          duration_min_minutes?: number | null;
          duration_typical_minutes?: number | null;
          duration_max_minutes?: number | null;
          complexity?: string;
          emergency_capable?: boolean;
          certifications?: Json;
          price_min?: number | null;
          price_typical?: number | null;
          price_max?: number | null;
          price_currency?: string;
          related_trades?: Json;
          match_keywords?: Json;
          metadata?: Json;
          sample_size?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_job_analyses: {
        Row: {
          id: string;
          service_request_id: string | null;
          booking_id: string | null;
          service_key: string | null;
          category_slug: string | null;
          analysis: Json;
          confidence: number | null;
          created_at: string;
          actual_duration_minutes: number | null;
          actual_materials: Json | null;
          actual_complexity: string | null;
          compared_at: string | null;
        };
        Insert: {
          id?: string;
          service_request_id?: string | null;
          booking_id?: string | null;
          service_key?: string | null;
          category_slug?: string | null;
          analysis: Json;
          confidence?: number | null;
          created_at?: string;
          actual_duration_minutes?: number | null;
          actual_materials?: Json | null;
          actual_complexity?: string | null;
          compared_at?: string | null;
        };
        Update: {
          id?: string;
          service_request_id?: string | null;
          booking_id?: string | null;
          service_key?: string | null;
          category_slug?: string | null;
          analysis?: Json;
          confidence?: number | null;
          created_at?: string;
          actual_duration_minutes?: number | null;
          actual_materials?: Json | null;
          actual_complexity?: string | null;
          compared_at?: string | null;
        };
        Relationships: [];
      };
      ai_vision_analyses: {
        Row: {
          id: string;
          content_hash: string;
          service_request_id: string | null;
          image_path: string | null;
          mime_type: string | null;
          byte_size: number | null;
          analysis: Json;
          fusion: Json | null;
          customer_summary_en: string | null;
          customer_summary_ar: string | null;
          customer_confirmed: boolean | null;
          customer_correction: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
          actual_damage: Json | null;
          actual_tools: Json | null;
          actual_materials: Json | null;
          compared_at: string | null;
        };
        Insert: {
          id?: string;
          content_hash: string;
          service_request_id?: string | null;
          image_path?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          analysis: Json;
          fusion?: Json | null;
          customer_summary_en?: string | null;
          customer_summary_ar?: string | null;
          customer_confirmed?: boolean | null;
          customer_correction?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
          actual_damage?: Json | null;
          actual_tools?: Json | null;
          actual_materials?: Json | null;
          compared_at?: string | null;
        };
        Update: {
          id?: string;
          content_hash?: string;
          service_request_id?: string | null;
          image_path?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          analysis?: Json;
          fusion?: Json | null;
          customer_summary_en?: string | null;
          customer_summary_ar?: string | null;
          customer_confirmed?: boolean | null;
          customer_correction?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
          actual_damage?: Json | null;
          actual_tools?: Json | null;
          actual_materials?: Json | null;
          compared_at?: string | null;
        };
        Relationships: [];
      };
      ai_voice_transcripts: {
        Row: {
          id: string;
          content_hash: string;
          service_request_id: string | null;
          audio_path: string | null;
          audio_bucket: string | null;
          mime_type: string | null;
          byte_size: number | null;
          original_transcript: string;
          normalized_transcript: string;
          edited_transcript: string | null;
          language: string | null;
          dialect: string | null;
          language_confidence: number | null;
          interpretation: Json | null;
          fusion: Json | null;
          detected_category_slug: string | null;
          detected_urgency: string | null;
          summary_en: string | null;
          summary_ar: string | null;
          customer_confirmed: boolean | null;
          customer_correction: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
          final_category_slug: string | null;
          compared_at: string | null;
        };
        Insert: {
          id?: string;
          content_hash: string;
          service_request_id?: string | null;
          audio_path?: string | null;
          audio_bucket?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          original_transcript: string;
          normalized_transcript: string;
          edited_transcript?: string | null;
          language?: string | null;
          dialect?: string | null;
          language_confidence?: number | null;
          interpretation?: Json | null;
          fusion?: Json | null;
          detected_category_slug?: string | null;
          detected_urgency?: string | null;
          summary_en?: string | null;
          summary_ar?: string | null;
          customer_confirmed?: boolean | null;
          customer_correction?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
          final_category_slug?: string | null;
          compared_at?: string | null;
        };
        Update: {
          id?: string;
          content_hash?: string;
          service_request_id?: string | null;
          audio_path?: string | null;
          audio_bucket?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          original_transcript?: string;
          normalized_transcript?: string;
          edited_transcript?: string | null;
          language?: string | null;
          dialect?: string | null;
          language_confidence?: number | null;
          interpretation?: Json | null;
          fusion?: Json | null;
          detected_category_slug?: string | null;
          detected_urgency?: string | null;
          summary_en?: string | null;
          summary_ar?: string | null;
          customer_confirmed?: boolean | null;
          customer_correction?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
          final_category_slug?: string | null;
          compared_at?: string | null;
        };
        Relationships: [];
      };
      ai_assistant_contexts: {
        Row: {
          id: string;
          service_request_id: string | null;
          booking_id: string | null;
          conversation_id: string | null;
          audience: string;
          phase: string;
          confirmed_facts: Json;
          asked_questions: Json;
          last_summary: Json | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_request_id?: string | null;
          booking_id?: string | null;
          conversation_id?: string | null;
          audience: string;
          phase?: string;
          confirmed_facts?: Json;
          asked_questions?: Json;
          last_summary?: Json | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string | null;
          booking_id?: string | null;
          conversation_id?: string | null;
          audience?: string;
          phase?: string;
          confirmed_facts?: Json;
          asked_questions?: Json;
          last_summary?: Json | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_conversation_summaries: {
        Row: {
          id: string;
          conversation_id: string;
          service_request_id: string | null;
          audience: string;
          summary: Json;
          message_count: number;
          source_hash: string | null;
          usefulness_rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          service_request_id?: string | null;
          audience: string;
          summary: Json;
          message_count?: number;
          source_hash?: string | null;
          usefulness_rating?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          service_request_id?: string | null;
          audience?: string;
          summary?: Json;
          message_count?: number;
          source_hash?: string | null;
          usefulness_rating?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_offer_comparisons: {
        Row: {
          id: string;
          service_request_id: string;
          comparison: Json;
          offer_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          comparison: Json;
          offer_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          comparison?: Json;
          offer_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      ai_proactive_suggestions: {
        Row: {
          id: string;
          service_request_id: string | null;
          booking_id: string | null;
          provider_id: string | null;
          customer_id: string | null;
          audience: string;
          suggestion_type: string;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
          action_key: string | null;
          priority: number;
          status: string;
          payload: Json;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          service_request_id?: string | null;
          booking_id?: string | null;
          provider_id?: string | null;
          customer_id?: string | null;
          audience: string;
          suggestion_type: string;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
          action_key?: string | null;
          priority?: number;
          status?: string;
          payload?: Json;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          service_request_id?: string | null;
          booking_id?: string | null;
          provider_id?: string | null;
          customer_id?: string | null;
          audience?: string;
          suggestion_type?: string;
          title_en?: string;
          title_ar?: string;
          body_en?: string;
          body_ar?: string;
          action_key?: string | null;
          priority?: number;
          status?: string;
          payload?: Json;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      ai_demand_forecasts: {
        Row: {
          id: string;
          forecast_date: string;
          hour_bucket: number | null;
          city_id: string | null;
          category_slug: string | null;
          predicted_requests: number;
          confidence: number | null;
          drivers: Json;
          model_version: string;
          actual_requests: number | null;
          compared_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          forecast_date: string;
          hour_bucket?: number | null;
          city_id?: string | null;
          category_slug?: string | null;
          predicted_requests?: number;
          confidence?: number | null;
          drivers?: Json;
          model_version?: string;
          actual_requests?: number | null;
          compared_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          forecast_date?: string;
          hour_bucket?: number | null;
          city_id?: string | null;
          category_slug?: string | null;
          predicted_requests?: number;
          confidence?: number | null;
          drivers?: Json;
          model_version?: string;
          actual_requests?: number | null;
          compared_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_availability_forecasts: {
        Row: {
          id: string;
          provider_id: string;
          forecast_date: string;
          predicted_free_hours: number;
          predicted_bookings: number;
          acceptance_probability: number | null;
          expected_workload: string | null;
          confidence: number | null;
          drivers: Json;
          actual_bookings: number | null;
          compared_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          forecast_date: string;
          predicted_free_hours?: number;
          predicted_bookings?: number;
          acceptance_probability?: number | null;
          expected_workload?: string | null;
          confidence?: number | null;
          drivers?: Json;
          actual_bookings?: number | null;
          compared_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          forecast_date?: string;
          predicted_free_hours?: number;
          predicted_bookings?: number;
          acceptance_probability?: number | null;
          expected_workload?: string | null;
          confidence?: number | null;
          drivers?: Json;
          actual_bookings?: number | null;
          compared_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_wait_time_estimates: {
        Row: {
          id: string;
          category_slug: string;
          city_id: string | null;
          response_min_minutes: number | null;
          response_max_minutes: number | null;
          arrival_min_minutes: number | null;
          arrival_max_minutes: number | null;
          confidence: number | null;
          sample_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_slug: string;
          city_id?: string | null;
          response_min_minutes?: number | null;
          response_max_minutes?: number | null;
          arrival_min_minutes?: number | null;
          arrival_max_minutes?: number | null;
          confidence?: number | null;
          sample_size?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_slug?: string;
          city_id?: string | null;
          response_min_minutes?: number | null;
          response_max_minutes?: number | null;
          arrival_min_minutes?: number | null;
          arrival_max_minutes?: number | null;
          confidence?: number | null;
          sample_size?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_marketplace_balances: {
        Row: {
          id: string;
          snapshot_at: string;
          category_slug: string | null;
          city_id: string | null;
          open_requests: number;
          available_providers: number;
          imbalance_ratio: number | null;
          severity: string;
          recommended_actions: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_at?: string;
          category_slug?: string | null;
          city_id?: string | null;
          open_requests?: number;
          available_providers?: number;
          imbalance_ratio?: number | null;
          severity?: string;
          recommended_actions?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_at?: string;
          category_slug?: string | null;
          city_id?: string | null;
          open_requests?: number;
          available_providers?: number;
          imbalance_ratio?: number | null;
          severity?: string;
          recommended_actions?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_prediction_outcomes: {
        Row: {
          id: string;
          prediction_type: string;
          reference_id: string | null;
          predicted: Json;
          actual: Json | null;
          error_metric: number | null;
          was_correct: boolean | null;
          created_at: string;
          compared_at: string | null;
        };
        Insert: {
          id?: string;
          prediction_type: string;
          reference_id?: string | null;
          predicted: Json;
          actual?: Json | null;
          error_metric?: number | null;
          was_correct?: boolean | null;
          created_at?: string;
          compared_at?: string | null;
        };
        Update: {
          id?: string;
          prediction_type?: string;
          reference_id?: string | null;
          predicted?: Json;
          actual?: Json | null;
          error_metric?: number | null;
          was_correct?: boolean | null;
          created_at?: string;
          compared_at?: string | null;
        };
        Relationships: [];
      };
      ai_predictive_notifications: {
        Row: {
          id: string;
          audience: string;
          user_id: string | null;
          provider_id: string | null;
          notification_type: string;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
          payload: Json;
          status: string;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          audience: string;
          user_id?: string | null;
          provider_id?: string | null;
          notification_type: string;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
          payload?: Json;
          status?: string;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          audience?: string;
          user_id?: string | null;
          provider_id?: string | null;
          notification_type?: string;
          title_en?: string;
          title_ar?: string;
          body_en?: string;
          body_ar?: string;
          payload?: Json;
          status?: string;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      ai_automation_policies: {
        Row: {
          id: string;
          policy_key: string;
          auto_execute_min: number;
          confirm_min: number;
          recommend_below: number;
          enabled: boolean;
          notes: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          policy_key?: string;
          auto_execute_min?: number;
          confirm_min?: number;
          recommend_below?: number;
          enabled?: boolean;
          notes?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          policy_key?: string;
          auto_execute_min?: number;
          confirm_min?: number;
          recommend_below?: number;
          enabled?: boolean;
          notes?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_provider_automation_settings: {
        Row: {
          provider_id: string;
          auto_accept_enabled: boolean;
          auto_reject_out_of_area: boolean;
          auto_reject_outside_hours: boolean;
          suggest_route_optimization: boolean;
          suggest_schedule_gaps: boolean;
          min_auto_accept_confidence: number;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          provider_id: string;
          auto_accept_enabled?: boolean;
          auto_reject_out_of_area?: boolean;
          auto_reject_outside_hours?: boolean;
          suggest_route_optimization?: boolean;
          suggest_schedule_gaps?: boolean;
          min_auto_accept_confidence?: number;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          provider_id?: string;
          auto_accept_enabled?: boolean;
          auto_reject_out_of_area?: boolean;
          auto_reject_outside_hours?: boolean;
          suggest_route_optimization?: boolean;
          suggest_schedule_gaps?: boolean;
          min_auto_accept_confidence?: number;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_automation_actions: {
        Row: {
          id: string;
          workflow_id: string;
          trigger_key: string;
          audience: string;
          action_type: string;
          status: string;
          confidence: number | null;
          decision_mode: string;
          reason_en: string;
          reason_ar: string;
          data_sources: Json;
          payload: Json;
          result: Json;
          module: string;
          reversible: boolean;
          reversed_at: string | null;
          user_id: string | null;
          provider_id: string | null;
          service_request_id: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          trigger_key: string;
          audience: string;
          action_type: string;
          status?: string;
          confidence?: number | null;
          decision_mode?: string;
          reason_en: string;
          reason_ar: string;
          data_sources?: Json;
          payload?: Json;
          result?: Json;
          module?: string;
          reversible?: boolean;
          reversed_at?: string | null;
          user_id?: string | null;
          provider_id?: string | null;
          service_request_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          trigger_key?: string;
          audience?: string;
          action_type?: string;
          status?: string;
          confidence?: number | null;
          decision_mode?: string;
          reason_en?: string;
          reason_ar?: string;
          data_sources?: Json;
          payload?: Json;
          result?: Json;
          module?: string;
          reversible?: boolean;
          reversed_at?: string | null;
          user_id?: string | null;
          provider_id?: string | null;
          service_request_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      ai_automation_approvals: {
        Row: {
          id: string;
          action_id: string;
          audience: string;
          user_id: string | null;
          provider_id: string | null;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
          status: string;
          modified_payload: Json | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          action_id: string;
          audience: string;
          user_id?: string | null;
          provider_id?: string | null;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
          status?: string;
          modified_payload?: Json | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          action_id?: string;
          audience?: string;
          user_id?: string | null;
          provider_id?: string | null;
          title_en?: string;
          title_ar?: string;
          body_en?: string;
          body_ar?: string;
          status?: string;
          modified_payload?: Json | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      ai_automation_feedback: {
        Row: {
          id: string;
          action_id: string;
          suggested_action: string;
          user_decision: string;
          confidence_before: number | null;
          confidence_delta: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          action_id: string;
          suggested_action: string;
          user_decision: string;
          confidence_before?: number | null;
          confidence_delta?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          action_id?: string;
          suggested_action?: string;
          user_decision?: string;
          confidence_before?: number | null;
          confidence_delta?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          provider_id: string;
          customer_id: string;
          service_id: string | null;
          service_request_id: string | null;
          conversation_id: string | null;
          status: BookingStatus;
          starts_at: string;
          ends_at: string;
          duration_minutes: number;
          timezone: string;
          location_text: string | null;
          location_lat: number | null;
          location_lng: number | null;
          customer_notes: string | null;
          provider_notes: string | null;
          preferred_contact: string | null;
          requires_provider_confirmation: boolean;
          is_recurring: boolean;
          recurrence_rule: string | null;
          parent_booking_id: string | null;
          cancelled_by: string | null;
          cancel_reason: string | null;
          declined_reason: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          expired_at: string | null;
          customer_confirmed_at: string | null;
          completion_prompted_at: string | null;
          issue_reason: string | null;
          issue_reported_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          provider_id: string;
          customer_id: string;
          service_id?: string | null;
          service_request_id?: string | null;
          conversation_id?: string | null;
          status?: BookingStatus;
          starts_at: string;
          ends_at: string;
          duration_minutes: number;
          timezone?: string;
          location_text?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          customer_notes?: string | null;
          provider_notes?: string | null;
          preferred_contact?: string | null;
          requires_provider_confirmation?: boolean;
          is_recurring?: boolean;
          recurrence_rule?: string | null;
          parent_booking_id?: string | null;
          cancelled_by?: string | null;
          cancel_reason?: string | null;
          declined_reason?: string | null;
          confirmed_at?: string | null;
          completed_at?: string | null;
          expired_at?: string | null;
          customer_confirmed_at?: string | null;
          completion_prompted_at?: string | null;
          issue_reason?: string | null;
          issue_reported_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          provider_id?: string;
          customer_id?: string;
          service_id?: string | null;
          service_request_id?: string | null;
          conversation_id?: string | null;
          status?: BookingStatus;
          starts_at?: string;
          ends_at?: string;
          duration_minutes?: number;
          timezone?: string;
          location_text?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          customer_notes?: string | null;
          provider_notes?: string | null;
          preferred_contact?: string | null;
          requires_provider_confirmation?: boolean;
          is_recurring?: boolean;
          recurrence_rule?: string | null;
          parent_booking_id?: string | null;
          cancelled_by?: string | null;
          cancel_reason?: string | null;
          declined_reason?: string | null;
          confirmed_at?: string | null;
          completed_at?: string | null;
          expired_at?: string | null;
          customer_confirmed_at?: string | null;
          completion_prompted_at?: string | null;
          issue_reason?: string | null;
          issue_reported_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      ai_marketplace_path_stats: {
        Row: {
          id: string;
          path: string;
          recommendation_accepted: number;
          recommendation_ignored: number;
          choices: number;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          path: string;
          recommendation_accepted?: number;
          recommendation_ignored?: number;
          choices?: number;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          path?: string;
          recommendation_accepted?: number;
          recommendation_ignored?: number;
          choices?: number;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      service_requests: {
        Row: {
          id: string;
          customer_id: string;
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
          lifecycle_version: number;
          selection_id: string | null;
          category_id: string | null;
          urgency: string | null;
          city_id: string | null;
          intent_text: string | null;
          category_confirmed: boolean;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          provider_id?: string | null;
          title: string;
          description: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          budget?: number | null;
          location_text?: string | null;
          status?: ServiceRequestStatus;
          accepted_at?: string | null;
          rejected_at?: string | null;
          quoted_at?: string | null;
          quote_accepted_at?: string | null;
          quote_declined_at?: string | null;
          in_progress_at?: string | null;
          completed_by_business_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          reviewed_at?: string | null;
          disputed_at?: string | null;
          dispute_note?: string | null;
          response_time_seconds?: number | null;
          completion_time_seconds?: number | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
          lifecycle_version?: number;
          selection_id?: string | null;
          category_id?: string | null;
          urgency?: string | null;
          city_id?: string | null;
          intent_text?: string | null;
          category_confirmed?: boolean;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          provider_id?: string | null;
          title?: string;
          description?: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          budget?: number | null;
          location_text?: string | null;
          status?: ServiceRequestStatus;
          accepted_at?: string | null;
          rejected_at?: string | null;
          quoted_at?: string | null;
          quote_accepted_at?: string | null;
          quote_declined_at?: string | null;
          in_progress_at?: string | null;
          completed_by_business_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          reviewed_at?: string | null;
          disputed_at?: string | null;
          dispute_note?: string | null;
          response_time_seconds?: number | null;
          completion_time_seconds?: number | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
          lifecycle_version?: number;
          selection_id?: string | null;
          category_id?: string | null;
          urgency?: string | null;
          city_id?: string | null;
          intent_text?: string | null;
          category_confirmed?: boolean;
          published_at?: string | null;
        };
        Relationships: [];
      };
      marketplace_selections: {
        Row: {
          id: string;
          service_request_id: string;
          provider_id: string | null;
          offer_id: string | null;
          status: string;
          selected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          provider_id?: string | null;
          offer_id?: string | null;
          status?: string;
          selected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          provider_id?: string | null;
          offer_id?: string | null;
          status?: string;
          selected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_request_projections: {
        Row: {
          service_request_id: string;
          lifecycle_phase: string;
          legacy_status: string;
          selection_id: string | null;
          lifecycle_version: number;
          synced_at: string;
        };
        Insert: {
          service_request_id: string;
          lifecycle_phase: string;
          legacy_status: string;
          selection_id?: string | null;
          lifecycle_version?: number;
          synced_at?: string;
        };
        Update: {
          service_request_id?: string;
          lifecycle_phase?: string;
          legacy_status?: string;
          selection_id?: string | null;
          lifecycle_version?: number;
          synced_at?: string;
        };
        Relationships: [];
      };
      match_pools: {
        Row: {
          id: string;
          service_request_id: string;
          cell_key: string;
          status: string;
          expand_count: number;
          initial_candidate_count: number;
          assigned_count: number;
          policy_snapshot: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          cell_key: string;
          status?: string;
          expand_count?: number;
          initial_candidate_count?: number;
          assigned_count?: number;
          policy_snapshot?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          cell_key?: string;
          status?: string;
          expand_count?: number;
          initial_candidate_count?: number;
          assigned_count?: number;
          policy_snapshot?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_assignments: {
        Row: {
          id: string;
          pool_id: string;
          service_request_id: string;
          provider_id: string;
          reason_codes: Json;
          rank_in_pool: number;
          source: string;
          assigned_at: string;
          ai_match_score: number | null;
          ai_explanation: Json;
          exposure_mode: string | null;
          response_band: string | null;
          response_probability: number | null;
          eta_label: string | null;
          operational_score: number | null;
          reputation_score: number | null;
        };
        Insert: {
          id?: string;
          pool_id: string;
          service_request_id: string;
          provider_id: string;
          reason_codes?: Json;
          rank_in_pool?: number;
          source?: string;
          assigned_at?: string;
          ai_match_score?: number | null;
          ai_explanation?: Json;
          exposure_mode?: string | null;
          response_band?: string | null;
          response_probability?: number | null;
          eta_label?: string | null;
          operational_score?: number | null;
          reputation_score?: number | null;
        };
        Update: {
          id?: string;
          pool_id?: string;
          service_request_id?: string;
          provider_id?: string;
          reason_codes?: Json;
          rank_in_pool?: number;
          source?: string;
          assigned_at?: string;
          ai_match_score?: number | null;
          ai_explanation?: Json;
          exposure_mode?: string | null;
          response_band?: string | null;
          response_probability?: number | null;
          eta_label?: string | null;
          operational_score?: number | null;
          reputation_score?: number | null;
        };
        Relationships: [];
      };
      marketplace_offers: {
        Row: {
          id: string;
          service_request_id: string;
          match_assignment_id: string;
          provider_id: string;
          price: number;
          currency: string;
          price_model: string;
          inclusions: string | null;
          eta_text: string | null;
          message: string | null;
          expires_at: string | null;
          status: string;
          quality_flags: Json;
          template_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          match_assignment_id: string;
          provider_id: string;
          price: number;
          currency?: string;
          price_model?: string;
          inclusions?: string | null;
          eta_text?: string | null;
          message?: string | null;
          expires_at?: string | null;
          status?: string;
          quality_flags?: Json;
          template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          match_assignment_id?: string;
          provider_id?: string;
          price?: number;
          currency?: string;
          price_model?: string;
          inclusions?: string | null;
          eta_text?: string | null;
          message?: string | null;
          expires_at?: string | null;
          status?: string;
          quality_flags?: Json;
          template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      offer_templates: {
        Row: {
          id: string;
          provider_id: string;
          label: string;
          price: number | null;
          currency: string;
          price_model: string;
          inclusions: string | null;
          eta_text: string | null;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          label: string;
          price?: number | null;
          currency?: string;
          price_model?: string;
          inclusions?: string | null;
          eta_text?: string | null;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          label?: string;
          price?: number | null;
          currency?: string;
          price_model?: string;
          inclusions?: string | null;
          eta_text?: string | null;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      offer_clarifications: {
        Row: {
          id: string;
          offer_id: string;
          service_request_id: string;
          author_id: string;
          author_role: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          service_request_id: string;
          author_id: string;
          author_role: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          offer_id?: string;
          service_request_id?: string;
          author_id?: string;
          author_role?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      unlock_sessions: {
        Row: {
          id: string;
          selection_id: string;
          service_request_id: string;
          provider_id: string;
          offer_id: string | null;
          status: string;
          fee_amount: number;
          fee_currency: string;
          sla_deadline: string;
          fallback_applied: boolean;
          idempotency_key: string;
          payment_stub_ref: string | null;
          payment_id: string | null;
          opened_at: string;
          updated_at: string;
          closed_at: string | null;
          admin_comp_reason: string | null;
        };
        Insert: {
          id?: string;
          selection_id: string;
          service_request_id: string;
          provider_id: string;
          offer_id?: string | null;
          status?: string;
          fee_amount: number;
          fee_currency?: string;
          sla_deadline: string;
          fallback_applied?: boolean;
          idempotency_key: string;
          payment_stub_ref?: string | null;
          payment_id?: string | null;
          opened_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          admin_comp_reason?: string | null;
        };
        Update: {
          id?: string;
          selection_id?: string;
          service_request_id?: string;
          provider_id?: string;
          offer_id?: string | null;
          status?: string;
          fee_amount?: number;
          fee_currency?: string;
          sla_deadline?: string;
          fallback_applied?: boolean;
          idempotency_key?: string;
          payment_stub_ref?: string | null;
          payment_id?: string | null;
          opened_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          admin_comp_reason?: string | null;
        };
        Relationships: [];
      };
      cell_policies: {
        Row: {
          cell_key: string;
          city_id: string | null;
          category_id: string | null;
          frozen: boolean;
          limited_availability: boolean;
          concierge: boolean;
          note: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          cell_key: string;
          city_id?: string | null;
          category_id?: string | null;
          frozen?: boolean;
          limited_availability?: boolean;
          concierge?: boolean;
          note?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          cell_key?: string;
          city_id?: string | null;
          category_id?: string | null;
          frozen?: boolean;
          limited_availability?: boolean;
          concierge?: boolean;
          note?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_release_grants: {
        Row: {
          id: string;
          unlock_session_id: string | null;
          service_request_id: string;
          provider_id: string;
          customer_id: string;
          scope: Json;
          granted_at: string;
          source: string;
        };
        Insert: {
          id?: string;
          unlock_session_id?: string | null;
          service_request_id: string;
          provider_id: string;
          customer_id: string;
          scope?: Json;
          granted_at?: string;
          source?: string;
        };
        Update: {
          id?: string;
          unlock_session_id?: string | null;
          service_request_id?: string;
          provider_id?: string;
          customer_id?: string;
          scope?: Json;
          granted_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      unlock_reliability_signals: {
        Row: {
          id: string;
          unlock_session_id: string;
          provider_id: string;
          signal_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          unlock_session_id: string;
          provider_id: string;
          signal_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          unlock_session_id?: string;
          provider_id?: string;
          signal_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      service_request_images: {
        Row: {
          id: string;
          request_id: string;
          bucket: string;
          path: string;
          mime_type: string | null;
          size_bytes: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          bucket?: string;
          path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          bucket?: string;
          path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          provider_id: string;
          customer_id: string;
          service_request_id: string | null;
          last_message_at: string;
          created_at: string;
          updated_at: string;
          status: string;
          pinned_by_customer: boolean;
          pinned_by_provider: boolean;
          archived_by_customer: boolean;
          archived_by_provider: boolean;
          deleted_at: string | null;
          closed_at: string | null;
          metadata: Json;
          thread_kind: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          customer_id: string;
          service_request_id?: string | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
          pinned_by_customer?: boolean;
          pinned_by_provider?: boolean;
          archived_by_customer?: boolean;
          archived_by_provider?: boolean;
          deleted_at?: string | null;
          closed_at?: string | null;
          metadata?: Json;
          thread_kind?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          customer_id?: string;
          service_request_id?: string | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
          pinned_by_customer?: boolean;
          pinned_by_provider?: boolean;
          archived_by_customer?: boolean;
          archived_by_provider?: boolean;
          deleted_at?: string | null;
          closed_at?: string | null;
          metadata?: Json;
          thread_kind?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body_text: string;
          is_system: boolean;
          event_type: string | null;
          created_at: string;
          message_type: string;
          delivery_status: string;
          edited_at: string | null;
          deleted_at: string | null;
          client_id: string | null;
          metadata: Json;
          location_lat: number | null;
          location_lng: number | null;
          location_label: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body_text: string;
          is_system?: boolean;
          event_type?: string | null;
          created_at?: string;
          message_type?: string;
          delivery_status?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
          client_id?: string | null;
          metadata?: Json;
          location_lat?: number | null;
          location_lng?: number | null;
          location_label?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body_text?: string;
          is_system?: boolean;
          event_type?: string | null;
          created_at?: string;
          message_type?: string;
          delivery_status?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
          client_id?: string | null;
          metadata?: Json;
          location_lat?: number | null;
          location_lng?: number | null;
          location_label?: string | null;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          service_request_id: string;
          provider_id: string;
          price: number;
          currency: string;
          estimated_duration_text: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          provider_id: string;
          price: number;
          currency?: string;
          estimated_duration_text?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          provider_id?: string;
          price?: number;
          currency?: string;
          estimated_duration_text?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          label: string;
          amount: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          label: string;
          amount?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string;
          label?: string;
          amount?: number;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      service_reviews: {
        Row: {
          id: string;
          service_request_id: string;
          provider_id: string;
          customer_id: string;
          rating: number;
          comment: string | null;
          recommend: boolean | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          status: "pending" | "approved" | "rejected" | "hidden";
          is_anonymous: boolean;
          is_verified: boolean;
          verified_booking: boolean;
          verified_customer: boolean;
          verified_interaction: boolean;
          helpful_count: number;
          provider_reply: string | null;
          provider_replied_at: string | null;
          provider_reply_by: string | null;
          booking_id: string | null;
          language: string | null;
          editable_until: string | null;
          edit_count: number;
          delete_requested_at: string | null;
          delete_request_reason: string | null;
          ai_summary: string | null;
          sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          provider_id: string;
          customer_id: string;
          rating: number;
          comment?: string | null;
          recommend?: boolean | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          status?: "pending" | "approved" | "rejected" | "hidden";
          is_anonymous?: boolean;
          is_verified?: boolean;
          verified_booking?: boolean;
          verified_customer?: boolean;
          verified_interaction?: boolean;
          helpful_count?: number;
          provider_reply?: string | null;
          provider_replied_at?: string | null;
          provider_reply_by?: string | null;
          booking_id?: string | null;
          language?: string | null;
          editable_until?: string | null;
          edit_count?: number;
          delete_requested_at?: string | null;
          delete_request_reason?: string | null;
          ai_summary?: string | null;
          sentiment?: "positive" | "neutral" | "negative" | "mixed" | null;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          provider_id?: string;
          customer_id?: string;
          rating?: number;
          comment?: string | null;
          recommend?: boolean | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          status?: "pending" | "approved" | "rejected" | "hidden";
          is_anonymous?: boolean;
          is_verified?: boolean;
          verified_booking?: boolean;
          verified_customer?: boolean;
          verified_interaction?: boolean;
          helpful_count?: number;
          provider_reply?: string | null;
          provider_replied_at?: string | null;
          provider_reply_by?: string | null;
          booking_id?: string | null;
          language?: string | null;
          editable_until?: string | null;
          edit_count?: number;
          delete_requested_at?: string | null;
          delete_request_reason?: string | null;
          ai_summary?: string | null;
          sentiment?: "positive" | "neutral" | "negative" | "mixed" | null;
        };
        Relationships: [];
      };
      service_review_helpful_votes: {
        Row: {
          review_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          review_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          review_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      service_review_images: {
        Row: {
          id: string;
          review_id: string;
          bucket: string;
          path: string;
          mime_type: string | null;
          size_bytes: number | null;
          sort_order: number;
          created_at: string;
          media_kind: "before" | "after" | "completed" | "general" | "video" | null;
        };
        Insert: {
          id?: string;
          review_id: string;
          bucket?: string;
          path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          created_at?: string;
          media_kind?: "before" | "after" | "completed" | "general" | "video" | null;
        };
        Update: {
          id?: string;
          review_id?: string;
          bucket?: string;
          path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          created_at?: string;
          media_kind?: "before" | "after" | "completed" | "general" | "video" | null;
        };
        Relationships: [];
      };
      review_ratings: {
        Row: {
          id: string;
          review_id: string;
          dimension: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          dimension: string;
          score: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          dimension?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      review_media: {
        Row: {
          id: string;
          review_id: string;
          media_kind: string;
          bucket: string;
          path: string;
          mime_type: string | null;
          size_bytes: number | null;
          sort_order: number;
          moderation_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          media_kind?: string;
          bucket?: string;
          path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          moderation_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          media_kind?: string;
          bucket?: string;
          path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          moderation_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      review_responses: {
        Row: {
          id: string;
          review_id: string;
          provider_id: string;
          body: string;
          created_by: string | null;
          created_at: string;
          edited_at: string | null;
          pinned_by_admin: boolean;
        };
        Insert: {
          id?: string;
          review_id: string;
          provider_id: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
          edited_at?: string | null;
          pinned_by_admin?: boolean;
        };
        Update: {
          id?: string;
          review_id?: string;
          provider_id?: string;
          body?: string;
          created_by?: string | null;
          created_at?: string;
          edited_at?: string | null;
          pinned_by_admin?: boolean;
        };
        Relationships: [];
      };
      review_ai_analysis: {
        Row: {
          review_id: string;
          short_summary: string | null;
          sentiment: string | null;
          topics: unknown;
          positive_highlights: unknown;
          improvement_suggestions: unknown;
          language_detected: string | null;
          translation_ready: boolean;
          fake_risk_score: number;
          fake_signals: unknown;
          model_version: string;
          analyzed_at: string;
          raw: unknown;
        };
        Insert: {
          review_id: string;
          short_summary?: string | null;
          sentiment?: string | null;
          topics?: unknown;
          positive_highlights?: unknown;
          improvement_suggestions?: unknown;
          language_detected?: string | null;
          translation_ready?: boolean;
          fake_risk_score?: number;
          fake_signals?: unknown;
          model_version?: string;
          analyzed_at?: string;
          raw?: unknown;
        };
        Update: {
          review_id?: string;
          short_summary?: string | null;
          sentiment?: string | null;
          topics?: unknown;
          positive_highlights?: unknown;
          improvement_suggestions?: unknown;
          language_detected?: string | null;
          translation_ready?: boolean;
          fake_risk_score?: number;
          fake_signals?: unknown;
          model_version?: string;
          analyzed_at?: string;
          raw?: unknown;
        };
        Relationships: [];
      };
      review_flags: {
        Row: {
          id: string;
          review_id: string;
          flag_type: string;
          severity: string;
          source: string;
          reason: string | null;
          metadata: unknown;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          flag_type: string;
          severity?: string;
          source?: string;
          reason?: string | null;
          metadata?: unknown;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          flag_type?: string;
          severity?: string;
          source?: string;
          reason?: string | null;
          metadata?: unknown;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      review_moderation: {
        Row: {
          id: string;
          review_id: string;
          action: string;
          actor_id: string | null;
          note: string | null;
          metadata: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          action: string;
          actor_id?: string | null;
          note?: string | null;
          metadata?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          action?: string;
          actor_id?: string | null;
          note?: string | null;
          metadata?: unknown;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_reputation_cache: {
        Row: {
          provider_id: string;
          recommendation_rate: number | null;
          ai_summary_en: string | null;
          ai_summary_ar: string | null;
          quality_label: string | null;
          response_rate: number | null;
          computed_at: string;
          payload: unknown;
          trust_level: string | null;
          trend: string | null;
        };
        Insert: {
          provider_id: string;
          recommendation_rate?: number | null;
          ai_summary_en?: string | null;
          ai_summary_ar?: string | null;
          quality_label?: string | null;
          response_rate?: number | null;
          computed_at?: string;
          payload?: unknown;
          trust_level?: string | null;
          trend?: string | null;
        };
        Update: {
          provider_id?: string;
          recommendation_rate?: number | null;
          ai_summary_en?: string | null;
          ai_summary_ar?: string | null;
          quality_label?: string | null;
          response_rate?: number | null;
          computed_at?: string;
          payload?: unknown;
          trust_level?: string | null;
          trend?: string | null;
        };
        Relationships: [];
      };
      review_settings: {
        Row: {
          id: string;
          edit_window_days: number;
          block_on_high_fake_risk: boolean;
          fake_risk_threshold: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          edit_window_days?: number;
          block_on_high_fake_risk?: boolean;
          fake_risk_threshold?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          edit_window_days?: number;
          block_on_high_fake_risk?: boolean;
          fake_risk_threshold?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_reputation_weights: {
        Row: {
          signal_key: string;
          category: string;
          weight: number;
          enabled: boolean;
          ml_ready: boolean;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          signal_key: string;
          category: string;
          weight?: number;
          enabled?: boolean;
          ml_ready?: boolean;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          signal_key?: string;
          category?: string;
          weight?: number;
          enabled?: boolean;
          ml_ready?: boolean;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_reputation_scores: {
        Row: {
          provider_id: string;
          internal_score: number;
          trust_level: string;
          search_boost: number;
          recommendation_boost: number;
          trend: string;
          signal_breakdown: unknown;
          previous_score: number | null;
          previous_trust_level: string | null;
          computed_at: string;
          model_version: string;
        };
        Insert: {
          provider_id: string;
          internal_score?: number;
          trust_level?: string;
          search_boost?: number;
          recommendation_boost?: number;
          trend?: string;
          signal_breakdown?: unknown;
          previous_score?: number | null;
          previous_trust_level?: string | null;
          computed_at?: string;
          model_version?: string;
        };
        Update: {
          provider_id?: string;
          internal_score?: number;
          trust_level?: string;
          search_boost?: number;
          recommendation_boost?: number;
          trend?: string;
          signal_breakdown?: unknown;
          previous_score?: number | null;
          previous_trust_level?: string | null;
          computed_at?: string;
          model_version?: string;
        };
        Relationships: [];
      };
      provider_reputation_signals: {
        Row: {
          id: string;
          provider_id: string;
          signal_key: string;
          category: string;
          raw_value: number | null;
          normalized_value: number;
          weight: number;
          contribution: number;
          source: string;
          metadata: unknown;
          computed_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          signal_key: string;
          category: string;
          raw_value?: number | null;
          normalized_value?: number;
          weight?: number;
          contribution?: number;
          source?: string;
          metadata?: unknown;
          computed_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          signal_key?: string;
          category?: string;
          raw_value?: number | null;
          normalized_value?: number;
          weight?: number;
          contribution?: number;
          source?: string;
          metadata?: unknown;
          computed_at?: string;
        };
        Relationships: [];
      };
      provider_reputation_explanations: {
        Row: {
          id: string;
          provider_id: string;
          audience: string;
          locale: string;
          explanation_key: string | null;
          body: string;
          polarity: string;
          sort_order: number;
          signal_key: string | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          audience: string;
          locale?: string;
          explanation_key?: string | null;
          body: string;
          polarity?: string;
          sort_order?: number;
          signal_key?: string | null;
          computed_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          audience?: string;
          locale?: string;
          explanation_key?: string | null;
          body?: string;
          polarity?: string;
          sort_order?: number;
          signal_key?: string | null;
          computed_at?: string;
        };
        Relationships: [];
      };
      provider_reputation_history: {
        Row: {
          id: string;
          provider_id: string;
          period: string;
          internal_score: number;
          trust_level: string;
          trend: string;
          signal_breakdown: unknown;
          search_boost: number | null;
          recommendation_boost: number | null;
          important_changes: unknown;
          period_start: string | null;
          period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          period: string;
          internal_score: number;
          trust_level: string;
          trend?: string;
          signal_breakdown?: unknown;
          search_boost?: number | null;
          recommendation_boost?: number | null;
          important_changes?: unknown;
          period_start?: string | null;
          period_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          period?: string;
          internal_score?: number;
          trust_level?: string;
          trend?: string;
          signal_breakdown?: unknown;
          search_boost?: number | null;
          recommendation_boost?: number | null;
          important_changes?: unknown;
          period_start?: string | null;
          period_end?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_reputation_events: {
        Row: {
          id: string;
          provider_id: string;
          event_type: string;
          actor_id: string | null;
          payload: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          event_type: string;
          actor_id?: string | null;
          payload?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          event_type?: string;
          actor_id?: string | null;
          payload?: unknown;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_request_settings: {
        Row: {
          provider_id: string;
          accepting_requests: boolean;
          max_pending_requests: number;
          auto_reject_message: string | null;
          vacation_mode: boolean;
          estimated_response_hours: number;
          handles_emergency: boolean;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          provider_id: string;
          accepting_requests?: boolean;
          max_pending_requests?: number;
          auto_reject_message?: string | null;
          vacation_mode?: boolean;
          estimated_response_hours?: number;
          handles_emergency?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          provider_id?: string;
          accepting_requests?: boolean;
          max_pending_requests?: number;
          auto_reject_message?: string | null;
          vacation_mode?: boolean;
          estimated_response_hours?: number;
          handles_emergency?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      marketplace_notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title_key: string;
          body_key: string;
          body_params: Json;
          href: string | null;
          service_request_id: string | null;
          conversation_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title_key: string;
          body_key: string;
          body_params?: Json;
          href?: string | null;
          service_request_id?: string | null;
          conversation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title_key?: string;
          body_key?: string;
          body_params?: Json;
          href?: string | null;
          service_request_id?: string | null;
          conversation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          slug: string;
          name: LocalizedJson;
          description: LocalizedJson | null;
          icon: string | null;
          is_active: boolean;
          sort_order: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          is_active?: boolean;
          sort_order?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          is_active?: boolean;
          sort_order?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      quality_cases: {
        Row: {
          id: string;
          case_number: string;
          category: string;
          status: string;
          priority: string;
          opened_by_role: string;
          opened_by: string | null;
          customer_id: string | null;
          provider_id: string | null;
          booking_id: string | null;
          payment_id: string | null;
          service_request_id: string | null;
          review_id: string | null;
          booking_issue_report_id: string | null;
          title: string;
          description: string;
          resolution_summary: string | null;
          satisfaction_score: number | null;
          assigned_admin_id: string | null;
          escalated_at: string | null;
          resolved_at: string | null;
          closed_at: string | null;
          merged_into_case_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_number: string;
          category: string;
          status?: string;
          priority?: string;
          opened_by_role: string;
          opened_by?: string | null;
          customer_id?: string | null;
          provider_id?: string | null;
          booking_id?: string | null;
          payment_id?: string | null;
          service_request_id?: string | null;
          review_id?: string | null;
          booking_issue_report_id?: string | null;
          title: string;
          description: string;
          resolution_summary?: string | null;
          satisfaction_score?: number | null;
          assigned_admin_id?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
          closed_at?: string | null;
          merged_into_case_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          case_number?: string;
          category?: string;
          status?: string;
          priority?: string;
          opened_by_role?: string;
          opened_by?: string | null;
          customer_id?: string | null;
          provider_id?: string | null;
          booking_id?: string | null;
          payment_id?: string | null;
          service_request_id?: string | null;
          review_id?: string | null;
          booking_issue_report_id?: string | null;
          title?: string;
          description?: string;
          resolution_summary?: string | null;
          satisfaction_score?: number | null;
          assigned_admin_id?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
          closed_at?: string | null;
          merged_into_case_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quality_case_messages: {
        Row: {
          id: string;
          case_id: string;
          author_id: string | null;
          author_role: string;
          visibility: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          author_id?: string | null;
          author_role: string;
          visibility?: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          author_id?: string | null;
          author_role?: string;
          visibility?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      quality_case_evidence: {
        Row: {
          id: string;
          case_id: string;
          evidence_type: string;
          uploaded_by: string | null;
          bucket: string;
          path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          reference_id: string | null;
          reference_label: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          evidence_type: string;
          uploaded_by?: string | null;
          bucket?: string;
          path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          reference_id?: string | null;
          reference_label?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          evidence_type?: string;
          uploaded_by?: string | null;
          bucket?: string;
          path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          reference_id?: string | null;
          reference_label?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      quality_case_history: {
        Row: {
          id: string;
          case_id: string;
          from_status: string | null;
          to_status: string | null;
          action: string;
          actor_id: string | null;
          actor_role: string | null;
          note: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          from_status?: string | null;
          to_status?: string | null;
          action: string;
          actor_id?: string | null;
          actor_role?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          from_status?: string | null;
          to_status?: string | null;
          action?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      quality_case_assignments: {
        Row: {
          id: string;
          case_id: string;
          admin_id: string;
          assigned_by: string | null;
          assigned_at: string;
          unassigned_at: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          admin_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
          unassigned_at?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          case_id?: string;
          admin_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
          unassigned_at?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      quality_case_ai_analysis: {
        Row: {
          case_id: string;
          sentiment: string | null;
          severity: number;
          urgency: number;
          risk_level: string;
          suggested_category: string | null;
          suggested_priority: string | null;
          suggested_resolution: string | null;
          repeated_pattern: boolean;
          pattern_notes: string | null;
          topics: Json;
          model_version: string;
          analyzed_at: string;
          raw: Json;
        };
        Insert: {
          case_id: string;
          sentiment?: string | null;
          severity?: number;
          urgency?: number;
          risk_level?: string;
          suggested_category?: string | null;
          suggested_priority?: string | null;
          suggested_resolution?: string | null;
          repeated_pattern?: boolean;
          pattern_notes?: string | null;
          topics?: Json;
          model_version?: string;
          analyzed_at?: string;
          raw?: Json;
        };
        Update: {
          case_id?: string;
          sentiment?: string | null;
          severity?: number;
          urgency?: number;
          risk_level?: string;
          suggested_category?: string | null;
          suggested_priority?: string | null;
          suggested_resolution?: string | null;
          repeated_pattern?: boolean;
          pattern_notes?: string | null;
          topics?: Json;
          model_version?: string;
          analyzed_at?: string;
          raw?: Json;
        };
        Relationships: [];
      };
      quality_case_metrics: {
        Row: {
          provider_id: string;
          total_cases: number;
          open_cases: number;
          resolved_cases: number;
          rejected_cases: number;
          complaint_rate: number | null;
          resolution_rate: number | null;
          avg_resolution_hours: number | null;
          repeat_complaint_count: number;
          avg_satisfaction: number | null;
          category_breakdown: Json;
          trend: Json;
          computed_at: string;
        };
        Insert: {
          provider_id: string;
          total_cases?: number;
          open_cases?: number;
          resolved_cases?: number;
          rejected_cases?: number;
          complaint_rate?: number | null;
          resolution_rate?: number | null;
          avg_resolution_hours?: number | null;
          repeat_complaint_count?: number;
          avg_satisfaction?: number | null;
          category_breakdown?: Json;
          trend?: Json;
          computed_at?: string;
        };
        Update: {
          provider_id?: string;
          total_cases?: number;
          open_cases?: number;
          resolved_cases?: number;
          rejected_cases?: number;
          complaint_rate?: number | null;
          resolution_rate?: number | null;
          avg_resolution_hours?: number | null;
          repeat_complaint_count?: number;
          avg_satisfaction?: number | null;
          category_breakdown?: Json;
          trend?: Json;
          computed_at?: string;
        };
        Relationships: [];
      };

      risk_rules: {
        Row: {
          id: string;
          rule_key: string;
          category: string;
          title: string;
          description: string | null;
          weight: number;
          threshold: number;
          enabled: boolean;
          ml_ready: boolean;
          auto_actions: Json;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rule_key: string;
          category: string;
          title: string;
          description?: string | null;
          weight?: number;
          threshold?: number;
          enabled?: boolean;
          ml_ready?: boolean;
          auto_actions?: Json;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rule_key?: string;
          category?: string;
          title?: string;
          description?: string | null;
          weight?: number;
          threshold?: number;
          enabled?: boolean;
          ml_ready?: boolean;
          auto_actions?: Json;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fraud_events: {
        Row: {
          id: string;
          event_type: string;
          entity_type: string;
          entity_id: string;
          severity: string;
          confidence: number;
          rule_key: string | null;
          title: string;
          summary: string | null;
          related_entity_ids: Json;
          metadata: Json;
          source: string;
          investigation_id: string | null;
          resolved_at: string | null;
          false_positive: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          entity_type: string;
          entity_id: string;
          severity?: string;
          confidence?: number;
          rule_key?: string | null;
          title: string;
          summary?: string | null;
          related_entity_ids?: Json;
          metadata?: Json;
          source?: string;
          investigation_id?: string | null;
          resolved_at?: string | null;
          false_positive?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          entity_type?: string;
          entity_id?: string;
          severity?: string;
          confidence?: number;
          rule_key?: string | null;
          title?: string;
          summary?: string | null;
          related_entity_ids?: Json;
          metadata?: Json;
          source?: string;
          investigation_id?: string | null;
          resolved_at?: string | null;
          false_positive?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      risk_scores: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          internal_score: number;
          risk_level: string;
          confidence: number;
          explanation: string | null;
          triggered_rules: Json;
          suggested_action: string | null;
          related_events: Json;
          duplicate_candidates: Json;
          signal_breakdown: Json;
          model_version: string;
          ml_contribution: number;
          computed_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          internal_score?: number;
          risk_level?: string;
          confidence?: number;
          explanation?: string | null;
          triggered_rules?: Json;
          suggested_action?: string | null;
          related_events?: Json;
          duplicate_candidates?: Json;
          signal_breakdown?: Json;
          model_version?: string;
          ml_contribution?: number;
          computed_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          internal_score?: number;
          risk_level?: string;
          confidence?: number;
          explanation?: string | null;
          triggered_rules?: Json;
          suggested_action?: string | null;
          related_events?: Json;
          duplicate_candidates?: Json;
          signal_breakdown?: Json;
          model_version?: string;
          ml_contribution?: number;
          computed_at?: string;
        };
        Relationships: [];
      };
      risk_score_history: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          from_score: number | null;
          to_score: number;
          from_level: string | null;
          to_level: string;
          triggered_rules: Json;
          actor_id: string | null;
          actor_role: string | null;
          reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          from_score?: number | null;
          to_score: number;
          from_level?: string | null;
          to_level: string;
          triggered_rules?: Json;
          actor_id?: string | null;
          actor_role?: string | null;
          reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          from_score?: number | null;
          to_score?: number;
          from_level?: string | null;
          to_level?: string;
          triggered_rules?: Json;
          actor_id?: string | null;
          actor_role?: string | null;
          reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      investigations: {
        Row: {
          id: string;
          case_number: string;
          title: string;
          status: string;
          priority: string;
          primary_entity_type: string;
          primary_entity_id: string;
          related_entity_ids: Json;
          assigned_admin_id: string | null;
          outcome: string | null;
          merged_into_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_number: string;
          title: string;
          status?: string;
          priority?: string;
          primary_entity_type: string;
          primary_entity_id: string;
          related_entity_ids?: Json;
          assigned_admin_id?: string | null;
          outcome?: string | null;
          merged_into_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          case_number?: string;
          title?: string;
          status?: string;
          priority?: string;
          primary_entity_type?: string;
          primary_entity_id?: string;
          related_entity_ids?: Json;
          assigned_admin_id?: string | null;
          outcome?: string | null;
          merged_into_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      investigation_history: {
        Row: {
          id: string;
          investigation_id: string;
          from_status: string | null;
          to_status: string | null;
          action: string;
          actor_id: string | null;
          note: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          investigation_id: string;
          from_status?: string | null;
          to_status?: string | null;
          action: string;
          actor_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          investigation_id?: string;
          from_status?: string | null;
          to_status?: string | null;
          action?: string;
          actor_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      investigation_notes: {
        Row: {
          id: string;
          investigation_id: string;
          author_id: string;
          body: string;
          visibility: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          investigation_id: string;
          author_id: string;
          body: string;
          visibility?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          investigation_id?: string;
          author_id?: string;
          body?: string;
          visibility?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      entity_relationships: {
        Row: {
          id: string;
          from_entity_type: string;
          from_entity_id: string;
          to_entity_type: string;
          to_entity_id: string;
          relationship_type: string;
          confirmed: boolean;
          confidence: number;
          evidence: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_entity_type: string;
          from_entity_id: string;
          to_entity_type: string;
          to_entity_id: string;
          relationship_type: string;
          confirmed?: boolean;
          confidence?: number;
          evidence?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_entity_type?: string;
          from_entity_id?: string;
          to_entity_type?: string;
          to_entity_id?: string;
          relationship_type?: string;
          confirmed?: boolean;
          confidence?: number;
          evidence?: Json;
          created_at?: string;
        };
        Relationships: [];
      };

      platform_health_metrics: {
        Row: {
          id: string;
          snapshot_at: string;
          period: string;
          active_users: number;
          bookings_today: number;
          completed_jobs: number;
          open_cases: number;
          escalated_cases: number;
          fraud_alerts: number;
          trust_distribution: Json;
          verification_pending: number;
          verification_verified: number;
          review_count_period: number;
          payment_success_rate: number | null;
          refund_rate: number | null;
          system_health: string;
          overall_score: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_at?: string;
          period?: string;
          active_users?: number;
          bookings_today?: number;
          completed_jobs?: number;
          open_cases?: number;
          escalated_cases?: number;
          fraud_alerts?: number;
          trust_distribution?: Json;
          verification_pending?: number;
          verification_verified?: number;
          review_count_period?: number;
          payment_success_rate?: number | null;
          refund_rate?: number | null;
          system_health?: string;
          overall_score?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_at?: string;
          period?: string;
          active_users?: number;
          bookings_today?: number;
          completed_jobs?: number;
          open_cases?: number;
          escalated_cases?: number;
          fraud_alerts?: number;
          trust_distribution?: Json;
          verification_pending?: number;
          verification_verified?: number;
          review_count_period?: number;
          payment_success_rate?: number | null;
          refund_rate?: number | null;
          system_health?: string;
          overall_score?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_anomalies: {
        Row: {
          id: string;
          anomaly_type: string;
          severity: string;
          title: string;
          summary: string | null;
          metric_key: string | null;
          baseline_value: number | null;
          current_value: number | null;
          deviation_pct: number | null;
          scope_type: string | null;
          scope_id: string | null;
          detected_at: string;
          resolved_at: string | null;
          false_positive: boolean;
          metadata: Json;
        };
        Insert: {
          id?: string;
          anomaly_type: string;
          severity?: string;
          title: string;
          summary?: string | null;
          metric_key?: string | null;
          baseline_value?: number | null;
          current_value?: number | null;
          deviation_pct?: number | null;
          scope_type?: string | null;
          scope_id?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
          false_positive?: boolean;
          metadata?: Json;
        };
        Update: {
          id?: string;
          anomaly_type?: string;
          severity?: string;
          title?: string;
          summary?: string | null;
          metric_key?: string | null;
          baseline_value?: number | null;
          current_value?: number | null;
          deviation_pct?: number | null;
          scope_type?: string | null;
          scope_id?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
          false_positive?: boolean;
          metadata?: Json;
        };
        Relationships: [];
      };
      platform_alerts: {
        Row: {
          id: string;
          alert_key: string;
          title: string;
          body: string | null;
          severity: string;
          status: string;
          source: string;
          anomaly_id: string | null;
          threshold_value: number | null;
          current_value: number | null;
          assigned_admin_id: string | null;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          resolved_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          alert_key: string;
          title: string;
          body?: string | null;
          severity?: string;
          status?: string;
          source?: string;
          anomaly_id?: string | null;
          threshold_value?: number | null;
          current_value?: number | null;
          assigned_admin_id?: string | null;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          alert_key?: string;
          title?: string;
          body?: string | null;
          severity?: string;
          status?: string;
          source?: string;
          anomaly_id?: string | null;
          threshold_value?: number | null;
          current_value?: number | null;
          assigned_admin_id?: string | null;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_trends: {
        Row: {
          id: string;
          metric_key: string;
          period: string;
          period_start: string;
          period_end: string;
          value: number;
          previous_value: number | null;
          change_pct: number | null;
          direction: string;
          scope_type: string;
          scope_id: string | null;
          metadata: Json;
          computed_at: string;
        };
        Insert: {
          id?: string;
          metric_key: string;
          period: string;
          period_start: string;
          period_end: string;
          value?: number;
          previous_value?: number | null;
          change_pct?: number | null;
          direction?: string;
          scope_type?: string;
          scope_id?: string | null;
          metadata?: Json;
          computed_at?: string;
        };
        Update: {
          id?: string;
          metric_key?: string;
          period?: string;
          period_start?: string;
          period_end?: string;
          value?: number;
          previous_value?: number | null;
          change_pct?: number | null;
          direction?: string;
          scope_type?: string;
          scope_id?: string | null;
          metadata?: Json;
          computed_at?: string;
        };
        Relationships: [];
      };
      category_health: {
        Row: {
          id: string;
          category_id: string;
          category_name: string | null;
          trust_level: string;
          growth_pct: number | null;
          complaint_rate: number | null;
          cancellation_rate: number | null;
          average_rating: number | null;
          completion_rate: number | null;
          customer_satisfaction: number | null;
          booking_count: number;
          provider_count: number;
          health_score: number;
          computed_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          category_name?: string | null;
          trust_level?: string;
          growth_pct?: number | null;
          complaint_rate?: number | null;
          cancellation_rate?: number | null;
          average_rating?: number | null;
          completion_rate?: number | null;
          customer_satisfaction?: number | null;
          booking_count?: number;
          provider_count?: number;
          health_score?: number;
          computed_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          category_name?: string | null;
          trust_level?: string;
          growth_pct?: number | null;
          complaint_rate?: number | null;
          cancellation_rate?: number | null;
          average_rating?: number | null;
          completion_rate?: number | null;
          customer_satisfaction?: number | null;
          booking_count?: number;
          provider_count?: number;
          health_score?: number;
          computed_at?: string;
        };
        Relationships: [];
      };
      region_health: {
        Row: {
          id: string;
          region_key: string;
          region_name: string | null;
          provider_density: number;
          demand_count: number;
          avg_response_hours: number | null;
          complaint_rate: number | null;
          trust_distribution: Json;
          booking_count: number;
          health_score: number;
          computed_at: string;
        };
        Insert: {
          id?: string;
          region_key: string;
          region_name?: string | null;
          provider_density?: number;
          demand_count?: number;
          avg_response_hours?: number | null;
          complaint_rate?: number | null;
          trust_distribution?: Json;
          booking_count?: number;
          health_score?: number;
          computed_at?: string;
        };
        Update: {
          id?: string;
          region_key?: string;
          region_name?: string | null;
          provider_density?: number;
          demand_count?: number;
          avg_response_hours?: number | null;
          complaint_rate?: number | null;
          trust_distribution?: Json;
          booking_count?: number;
          health_score?: number;
          computed_at?: string;
        };
        Relationships: [];
      };
      platform_ops_tasks: {
        Row: {
          id: string;
          title: string;
          body: string | null;
          status: string;
          priority: string;
          assigned_admin_id: string | null;
          created_by: string | null;
          alert_id: string | null;
          related_href: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string | null;
          status?: string;
          priority?: string;
          assigned_admin_id?: string | null;
          created_by?: string | null;
          alert_id?: string | null;
          related_href?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string | null;
          status?: string;
          priority?: string;
          assigned_admin_id?: string | null;
          created_by?: string | null;
          alert_id?: string | null;
          related_href?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      platform_ops_audit: {
        Row: {
          id: string;
          action: string;
          actor_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          note: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          actor_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          action?: string;
          actor_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      next_investigation_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      next_quality_case_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      accept_service_request: {
        Args: { p_request_id: string; p_actor_id: string };
        Returns: string;
      };
      reject_service_request: {
        Args: { p_request_id: string; p_actor_id: string };
        Returns: undefined;
      };
      post_system_message: {
        Args: {
          p_conversation_id: string;
          p_actor_id: string;
          p_body: string;
          p_event_type: string;
        };
        Returns: string;
      };
      notify_marketplace_user: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title_key: string;
          p_body_key: string;
          p_body_params?: Json;
          p_href?: string | null;
          p_request_id?: string | null;
          p_conversation_id?: string | null;
        };
        Returns: string;
      };
      recompute_provider_trust_score: {
        Args: { p_provider_id: string };
        Returns: number;
      };
    };
    Enums: {
      user_status: UserStatus;
      app_role: AppRole;
      provider_status: ProviderStatus;
      verification_status: VerificationStatus;
      problem_priority: ProblemPriority;
      provider_verification_status: ProviderVerificationStatus;
      subscription_status: SubscriptionStatus;
      payment_provider: PaymentProviderType;
      payment_status: PaymentStatus;
      invoice_status: InvoiceStatus;
      audit_action: AuditAction;
      service_request_status: ServiceRequestStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
