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
export type PaymentProviderType = "manual" | "shamcash" | "future";
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
  | "subscription_extended"
  | "subscription_cancelled"
  | "subscription_plan_changed"
  | "category_created"
  | "category_updated"
  | "category_disabled"
  | "category_enabled";

export type PaymentEventType = "requested" | "receipt_uploaded" | "approved" | "rejected";

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
      service_requests: {
        Row: {
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
        Insert: {
          id?: string;
          customer_id: string;
          provider_id: string;
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
        };
        Update: {
          id?: string;
          customer_id?: string;
          provider_id?: string;
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
        };
        Insert: {
          id?: string;
          provider_id: string;
          customer_id: string;
          service_request_id?: string | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          customer_id?: string;
          service_request_id?: string | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
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
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body_text: string;
          is_system?: boolean;
          event_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body_text?: string;
          is_system?: boolean;
          event_type?: string | null;
          created_at?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
